import { useCallback, useEffect, useState } from 'react';

export const useWizardCredentials = (isOpen: boolean, endpoint: string) => {
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

  const checkCredentials = useCallback(async () => {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHasCredentials(data.has_credentials);
        return;
      }
      setHasCredentials(false);
    } catch {
      setHasCredentials(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!isOpen) return;
    setHasCredentials(null);
    checkCredentials();
  }, [isOpen, checkCredentials]);

  return { hasCredentials, checkCredentials };
};
