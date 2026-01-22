'use client';

import { useAuthRedirect } from './features/auth/hooks/useAuthRedirect';
import LandingPage from './landing/page';

export default function Home() {
  const { isLoading } = useAuthRedirect('/dashboard');

  // 로딩 중에는 빈 화면 표시 (깜빡임 방지)
  if (isLoading) {
    return null;
  }

  return <LandingPage />;
}
