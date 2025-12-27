'use client';

import { useRouter } from 'next/navigation';

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
};

export function LLMProviderRegisterButton({
  onClick,
  disabled,
  href = '/settings/provider',
}: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      router.push(href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-full rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
        disabled
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
    >
      LLM provider 등록
    </button>
  );
}
