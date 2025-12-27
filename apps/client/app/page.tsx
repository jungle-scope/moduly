'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // 로그인 페이지로 즉시 리다이렉트
    redirect('/auth/login');
  }, []);

  return null;
}
