'use client';

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
};

export function LLMProviderRegisterButton({
  onClick,
  disabled,
  href = '/dashboard/settings',
}: Props) {
  const openInNewTab = () => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      openInNewTab();
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
