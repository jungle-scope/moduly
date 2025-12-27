'use client';

import { useRouter } from 'next/navigation';
import { authApi } from '@/app/features/auth/api/authApi';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      router.push('/auth/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
    >
      로그아웃
    </button>
  );
}
