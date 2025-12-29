'use client';

import { useState } from 'react';
import { Toast } from '@/app/components/ui/toast/Toast';

interface SuccessData {
  success: true;
  url_slug: string | null;
  auth_secret: string | null;
  version: number;
}

interface ErrorData {
  success: false;
  message: string;
}

interface Props {
  onClose: () => void;
  result: SuccessData | ErrorData;
}

export function DeploymentResultModal({ onClose, result }: Props) {
  const [showToast, setShowToast] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowToast(true);
  };

  // 실패 케이스
  if (!result.success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
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
            <p className="text-gray-700 text-sm">{result.message}</p>
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 성공 케이스
  const API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/run/${result.url_slug}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h2 className="text-xl font-bold">
                배포 성공 (v{result.version})
              </h2>
            </div>
            <p className="text-sm text-green-600 mt-1 ml-8">
              워크플로우가 성공적으로 배포되었습니다.
            </p>
          </div>

          {/* 바디 */}
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                API Endpoint URL
              </label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 font-mono break-all leading-relaxed">
                  {API_URL}
                </code>
                <button
                  onClick={() => handleCopy(API_URL)}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors whitespace-nowrap h-fit"
                >
                  복사
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                API Secret Key
              </label>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 font-mono break-all leading-relaxed">
                  {result.auth_secret || 'N/A (Public)'}
                </code>
                {result.auth_secret && (
                  <button
                    onClick={() => handleCopy(result.auth_secret!)}
                    className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors whitespace-nowrap h-fit"
                  >
                    복사
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
            >
              확인
            </button>
          </div>
        </div>
      </div>

      <Toast
        message="Copied!"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={1000}
      />
    </>
  );
}
