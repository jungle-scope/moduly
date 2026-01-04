'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface DeploymentInfo {
  url_slug: string;
  version: number;
  description?: string;
  type: string;
  input_schema?: {
    variables: Array<{
      name: string;
      type: string;
      label: string;
    }>;
  };
  output_schema?: {
    outputs: Array<{
      variable: string;
      label: string;
    }>;
  };
}

export default function SharedWorkflowPage() {
  const params = useParams();
  const urlSlug = params.urlSlug as string;

  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(
    null,
  );
  const [inputs, setInputs] = useState<Record<string, string>>({}); // 동적 입력값
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);

  // 배포 정보 가져오기
  useEffect(() => {
    async function fetchDeploymentInfo() {
      try {
        setInfoLoading(true);
        const response = await fetch(
          `/api/v1/deployments/public/${urlSlug}/info`,
        );

        if (!response.ok) {
          throw new Error('배포 정보를 가져올 수 없습니다.');
        }

        const data = await response.json();
        setDeploymentInfo(data);

        // 입력 필드 초기화
        if (data.input_schema?.variables) {
          const initialInputs: Record<string, string> = {};
          data.input_schema.variables.forEach((v: any) => {
            initialInputs[v.name] = '';
          });
          setInputs(initialInputs);
        }
      } catch (err: any) {
        setError(err.message || '배포 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setInfoLoading(false);
      }
    }

    if (urlSlug) {
      fetchDeploymentInfo();
    }
  }, [urlSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 모든 필수 입력 검증
    const variables = deploymentInfo?.input_schema?.variables || [];
    for (const variable of variables) {
      if (!inputs[variable.name]?.trim()) {
        setError(`${variable.label}을(를) 입력해주세요.`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/v1/run-public/${urlSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: inputs, // 동적으로 생성된 inputs 객체 전송
        }),
      });

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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {deploymentInfo?.description || '공유된 워크플로우'}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              배포 버전:{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">
                v{deploymentInfo?.version || '?'}
              </code>
            </span>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {infoLoading ? (
            <div className="text-center py-8 text-gray-500">
              배포 정보를 불러오는 중...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 동적 입력 필드 생성 */}
              {deploymentInfo?.input_schema?.variables.map((variable) => (
                <div key={variable.name}>
                  <label
                    htmlFor={variable.name}
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {variable.label}
                  </label>
                  <textarea
                    id={variable.name}
                    value={inputs[variable.name] || ''}
                    onChange={(e) =>
                      setInputs({ ...inputs, [variable.name]: e.target.value })
                    }
                    placeholder={`${variable.label}을(를) 입력하세요...`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                    disabled={loading}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (
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
                  <span>실행</span>
                )}
              </button>
            </form>
          )}

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
