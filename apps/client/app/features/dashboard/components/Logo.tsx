'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Logo() {
  const router = useRouter();

  return (
    <div className="h-12 w-52 bg-gradient-to-b from-blue-50 via-white to-blue-50/30 flex items-center px-4 border-r border-gray-200">
      <button
        onClick={() => router.push('/dashboard')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        <Image
          src="/moduly-logo.png"
          alt="Moduly Logo"
          width={120}
          height={32}
          className="h-7 w-auto"
          priority
        />
      </button>
    </div>
  );
}
