'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function SharedWorkflowPage() {
  const params = useParams();
  const urlSlug = params.urlSlug as string;

  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      setError('입력을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/run-public/${urlSlug}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: { user_input: input },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `배포된 워크플로우를 실행할 수 없습니다. (${response.status})`,
        );
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            공유된 워크플로우
          </h1>
          <p className="text-sm text-gray-500">
            배포 ID:{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">{urlSlug}</code>
          </p>
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="input"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                메시지를 입력하세요
              </label>
              <textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="여기에 입력하세요..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  실행 중...
                </span>
              ) : (
                '실행'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong className="font-semibold">오류:</strong> {error}
              </p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">결과</h3>

              {result.status === 'success' && result.results ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-auto">
                    {JSON.stringify(result.results, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Powered by Moduly
        </div>
      </div>
    </div>
  );
}
