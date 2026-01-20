'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Logo({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();

  return (
    <div
      className={`w-full flex items-center ${
        collapsed ? 'justify-center pt-8 pb-4' : 'px-4 pt-8 pb-4'
      }`}
    >
      <button
        onClick={() => router.push('/dashboard')}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        {collapsed ? (
          <Image
            src="/moduly-logo-small.png"
            alt="Moduly Small Logo"
            width={32}
            height={32}
            className="h-8 w-auto ml-[4px]"
            priority
          />
        ) : (
          <Image
            src="/moduly-logo.png"
            alt="Moduly Logo"
            width={120}
            height={32}
            className="h-8 w-auto"
            priority
          />
        )}
      </button>
    </div>
  );
}
