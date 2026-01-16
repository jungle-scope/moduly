import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = '/api/v1';

interface Provider {
  id: string;
  name: string;
}

interface Credential {
  id: string;
  provider_id: string;
  is_valid: boolean;
}

export function useGenericCredential(providerName: string) {
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkCredential = useCallback(async () => {
    try {
      setIsLoading(true);
      // 1. Provider 목록 조회
      const provRes = await fetch(`${API_BASE_URL}/llm/providers`, {
        credentials: 'include',
      });
      if (!provRes.ok) throw new Error('Failed to fetch providers');
      const providers: Provider[] = await provRes.json();

      // 2. Credential 목록 조회
      const credRes = await fetch(`${API_BASE_URL}/llm/credentials`, {
        credentials: 'include',
      });
      if (!credRes.ok) throw new Error('Failed to fetch credentials');
      const credentials: Credential[] = await credRes.json();

      // 3. 매칭되는 유효한 키가 있는지 확인
      const targetProvider = providers.find(
        (p: Provider) => p.name.toLowerCase() === providerName.toLowerCase(),
      );

      if (!targetProvider) {
        setHasKey(false);
      } else {
        const found = credentials.some(
          (c: Credential) => c.provider_id === targetProvider.id && c.is_valid,
        );
        setHasKey(found);
      }
    } catch (e) {
      console.error(e);
      setHasKey(false);
    } finally {
      setIsLoading(false);
    }
  }, [providerName]);

  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  return {
    hasKey,
    isLoading,
    refresh: checkCredential,
  };
}
