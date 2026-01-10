'use client';

interface ErrorStepProps {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ErrorStep({ message, onRetry, onClose }: ErrorStepProps) {
  return (
    <>
      <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700">
        <svg
          className="w-6 h-6 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="font-bold text-lg">배포 실패</h2>
      </div>

      <div className="p-6">
        <p className="text-gray-700 text-sm">{message}</p>
      </div>

      <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
        >
          닫기
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          다시 시도
        </button>
      </div>
    </>
  );
}
