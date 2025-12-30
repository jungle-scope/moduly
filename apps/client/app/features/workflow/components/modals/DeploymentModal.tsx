'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSubmit: (description: string) => void;
  isDeploying?: boolean;
}

export function DeploymentModal({
  onClose,
  onSubmit,
  isDeploying = false,
}: Props) {
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit(description);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            워크플로우 배포
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            현재 상태를 배포하여 API로 사용할 수 있게 만듭니다.
          </p>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            배포 설명 (선택)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
            placeholder="이번 배포에 대한 설명을 적어주세요 (예: V1.0 출시)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isDeploying}
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeploying}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isDeploying}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeploying ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                배포 중...
              </>
            ) : (
              '🚀 배포하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
