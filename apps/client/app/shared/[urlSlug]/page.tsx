'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface DeploymentInfo {
  url_slug: string;
  name: string;
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

// 타입 기반 라벨 반환
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    text: '텍스트',
    paragraph: '장문 텍스트',
    number: '숫자',
    select: '선택 항목',
    checkbox: '체크박스',
    file: '파일 첨부',
  };
  return labels[type] || '입력';
};

// 타입 기반 placeholder 반환
const getPlaceholder = (type: string): string => {
  const placeholders: Record<string, string> = {
    text: '텍스트를 입력해 주세요',
    paragraph: '내용을 자유롭게 작성해 주세요',
    number: '숫자를 입력해 주세요',
    file: '파일을 선택하거나 드래그해 주세요',
  };
  return placeholders[type] || '값을 입력해 주세요';
};

// 라벨 표시 (새 변수일 경우 타입 기반 라벨로 폴백)
const getDisplayLabel = (label: string, type: string): string => {
  if (label === '새 변수' || !label) {
    return getTypeLabel(type);
  }
  return label;
};

// placeholder 표시 (새 변수일 경우 타입 기반 placeholder로 폴백)
const getDisplayPlaceholder = (label: string, type: string): string => {
  if (label === '새 변수' || !label) {
    return getPlaceholder(type);
  }
  return `${label}을(를) 입력해 주세요`;
};

// 마크다운 볼드(**text**) 렌더링
const renderTextWithBold = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

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
        const displayLabel = getDisplayLabel(variable.label, variable.type);
        setError(`${displayLabel}을(를) 입력해주세요.`);
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {deploymentInfo?.name || '워크플로우'}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 rounded-full">
              v{deploymentInfo?.version || '?'}
            </span>
          </div>
          {deploymentInfo?.description && (
            <p className="text-gray-600 mt-2">{deploymentInfo.description}</p>
          )}
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {infoLoading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 text-gray-500">
                <svg
                  className="animate-spin h-5 w-5 text-sky-500"
                  viewBox="0 0 24 24"
                >
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
                배포 정보를 불러오는 중...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 동적 입력 필드 생성 */}
              {deploymentInfo?.input_schema?.variables.map((variable) => (
                <div key={variable.name}>
                  <label
                    htmlFor={variable.name}
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {getDisplayLabel(variable.label, variable.type)}
                  </label>
                  <textarea
                    id={variable.name}
                    value={inputs[variable.name] || ''}
                    onChange={(e) =>
                      setInputs({ ...inputs, [variable.name]: e.target.value })
                    }
                    placeholder={getDisplayPlaceholder(
                      variable.label,
                      variable.type,
                    )}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg 
                             text-gray-900 placeholder-gray-400
                             focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 
                             focus:outline-none resize-none
                             transition-all duration-200"
                    rows={4}
                    disabled={loading}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white 
                          transition-all duration-200
                          ${
                            loading
                              ? 'bg-gradient-to-r from-sky-400 to-cyan-400 cursor-not-allowed opacity-70'
                              : 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 active:from-sky-700 active:to-cyan-700 shadow-sm hover:shadow-md'
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
            <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-start gap-2">
                <svg
                  className="w-5 h-5 flex-shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </p>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="mt-6 space-y-4">
              {result.status === 'success' && result.results ? (
                <div className="space-y-3">
                  {deploymentInfo?.output_schema?.outputs?.map((output) => {
                    const value = result.results[output.variable];
                    if (value === undefined || value === null) return null;

                    const displayValue =
                      typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : String(value);

                    return (
                      <div
                        key={output.variable}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                      >
                        {/* 라벨 헤더 */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-green-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">
                              {output.label || output.variable}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(displayValue);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
                            title="복사"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                        {/* 값 내용 */}
                        <div className="px-4 py-3">
                          <div className="text-gray-900 whitespace-pre-wrap leading-relaxed text-sm">
                            {renderTextWithBold(displayValue)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* output_schema가 없는 경우 폴백 */}
                  {(!deploymentInfo?.output_schema?.outputs ||
                    deploymentInfo.output_schema.outputs.length === 0) && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
                        <svg
                          className="w-4 h-4 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          실행 완료
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <div className="text-gray-900 whitespace-pre-wrap leading-relaxed text-sm">
                          {typeof result.results === 'object'
                            ? Object.entries(result.results).map(
                                ([key, val]) => (
                                  <div key={key} className="mb-2 last:mb-0">
                                    <span className="font-medium text-gray-600">
                                      {key}:{' '}
                                    </span>
                                    <span>
                                      {typeof val === 'object'
                                        ? JSON.stringify(val)
                                        : String(val)}
                                    </span>
                                  </div>
                                ),
                              )
                            : String(result.results)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-700">
                    {result.message || '처리 중 문제가 발생했습니다.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-400">
          Powered by <span className="font-medium text-gray-500">Moduly</span>
        </div>
      </div>
    </div>
  );
}
