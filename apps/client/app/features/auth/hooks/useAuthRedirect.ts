'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/authApi';

interface UseAuthRedirectResult {
  isLoading: boolean;
}

/**
 * 로그인 상태를 확인하고, 로그인 되어있으면 지정된 경로로 리다이렉트합니다.
 * @param redirectTo 로그인 상태일 때 이동할 경로 (기본값: '/dashboard')
 */
export function useAuthRedirect(
  redirectTo: string = '/dashboard',
): UseAuthRedirectResult {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        await authApi.me();
        // 로그인 상태이면 리다이렉트
        router.replace(redirectTo);
      } catch {
        // 비로그인 상태이면 현재 페이지 유지
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [router, redirectTo]);

  return { isLoading };
}
