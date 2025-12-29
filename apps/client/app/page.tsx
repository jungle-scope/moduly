'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApi } from './features/auth/api/authApi';

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // JWT 토큰 검증 시도
        await authApi.me();
        // 성공 → 로그인됨 → 대시보드로 이동
        router.push('/dashboard');
      } catch {
        // 실패 → 로그인 안 됨 → 로그인 페이지로 이동
        router.push('/auth/login');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  // 인증 확인 중에는 빈 화면 표시
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return null;
}
