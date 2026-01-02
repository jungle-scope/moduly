'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { InputSchema, OutputSchema } from '../../types/Deployment';

interface SuccessData {
  success: true;
  url_slug: string | null;
  auth_secret: string | null;
  version: number;
  webAppUrl?: string; // 웹 앱 공유 링크
  embedUrl?: string; // 임베딩 채팅 URL
  isWorkflowNode?: boolean; // 워크플로우 노드 배포 여부
  input_schema?: InputSchema | null;
  output_schema?: OutputSchema | null;
}

interface ErrorData {
  success: false;
  message: string;
}

interface Props {
  onClose: () => void;
  result: SuccessData | ErrorData;
}

// curl 예시 생성 함수
function generateCurlExample(
  apiUrl: string,
  authSecret: string | null,
  inputSchema?: InputSchema | null,
): string {
  // 입력 스키마를 기반으로 inputs 객체 생성
  let inputsExample: Record<string, string> = {};

  if (
    inputSchema &&
    inputSchema.variables &&
    inputSchema.variables.length > 0
  ) {
    inputsExample = inputSchema.variables.reduce(
      (acc, variable) => {
        // 모든 타입을 빈 문자열로 설정 (사용자가 직접 입력)
        acc[variable.name] = '';
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  const inputsJson = JSON.stringify(inputsExample, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `    ${line}`))
    .join('\n');

  const authHeader = authSecret
    ? `  -H "Authorization: Bearer ${authSecret}" \\\n`
    : '';

  return `curl -X POST "${apiUrl}" \\
  -H "Content-Type: application/json" \\
${authHeader}  -d '{
    "inputs": ${inputsJson}
  }'`;
}

export function DeploymentResultModal({ onClose, result }: Props) {
  const [showSchemas, setShowSchemas] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('클립보드에 복사되었습니다!', {
      duration: 1000,
    });
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
            {/* 웹 앱 공유 링크 (웹 앱 배포 시에만 표시) */}
            {result.webAppUrl && (
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <label className="block text-sm font-semibold text-blue-900 mb-2">
                  🌐 웹 앱 공유 링크
                </label>
                <p className="text-xs text-blue-700 mb-3">
                  이 링크를 공유하면 누구나 워크플로우를 사용할 수 있습니다!
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 bg-white border border-blue-300 rounded text-sm text-blue-800 font-mono break-all leading-relaxed">
                    {result.webAppUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(result.webAppUrl!)}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors whitespace-nowrap h-fit"
                  >
                    복사
                  </button>
                </div>
              </div>
            )}

            {/* 임베딩 위젯 코드 (임베딩 배포 시에만 표시) */}
            {result.embedUrl && (
              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <label className="block text-sm font-semibold text-purple-900 mb-2">
                  💬 웹사이트 임베딩 코드
                </label>
                <p className="text-xs text-purple-700 mb-3">
                  아래 코드를 복사하여 웹사이트의{' '}
                  <code className="bg-purple-200 px-1 rounded">
                    &lt;/body&gt;
                  </code>{' '}
                  태그 직전에 붙여넣으세요!
                </p>
                <div className="relative">
                  <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
                    {`<script>
  window.ModulyConfig = {
    appId: '${result.url_slug}'
  };
</script>
<script src="http://localhost:8000/static/widget.js"></script>`}
                  </pre>
                  <button
                    onClick={() =>
                      handleCopy(
                        `<script>
  window.ModulyConfig = {
    appId: '${result.url_slug}'
  };
</script>
<script src="http://localhost:8000/static/widget.js"></script>`,
                      )
                    }
                    className="absolute top-2 right-2 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    복사
                  </button>
                </div>
                <div className="mt-3 p-3 bg-purple-100 rounded border border-purple-200">
                  <p className="text-xs text-purple-800">
                    <strong>💡 미리보기:</strong> 우하단에 채팅 버튼이 나타나며,
                    클릭하면 채팅창이 열립니다.{' '}
                    <a
                      href={result.embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold"
                    >
                      테스트 페이지 열기 →
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* 워크플로우 노드 배포 성공 (API/WebApp/Widget 아님) */}
            {result.isWorkflowNode && (
              <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                <label className="block text-sm font-semibold text-indigo-900 mb-2">
                  🧩 워크플로우 노드 배포 완료
                </label>
                <p className="text-xs text-indigo-700 mb-3">
                  이 워크플로우는 이제 다른 워크플로우에서 '사용자 정의 노드'로
                  불러와 사용할 수 있습니다.
                </p>
                <div className="bg-white p-3 rounded border border-indigo-200 text-sm text-gray-700">
                  <p>
                    <strong>버전:</strong> {result.version}
                  </p>
                </div>
              </div>
            )}

            {/* API Secret Key (웹 앱이나 임베딩, 워크플로우 노드가 아닐 때만 표시) */}
            {!result.webAppUrl &&
              !result.embedUrl &&
              !result.isWorkflowNode && (
                <>
                  {/* API Endpoint (웹 앱이 아닐 때만 표시) */}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Test Command (cURL)
                    </label>
                    <div className="relative">
                      <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
                        {generateCurlExample(
                          API_URL,
                          result.auth_secret,
                          result.input_schema,
                        )}
                      </pre>
                      <button
                        onClick={() =>
                          handleCopy(
                            generateCurlExample(
                              API_URL,
                              result.auth_secret,
                              result.input_schema,
                            ),
                          )
                        }
                        className="absolute top-2 right-2 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      >
                        복사
                      </button>
                    </div>
                  </div>

                  {/* 스키마 정보 토글 버튼 */}
                  {((result.input_schema &&
                    result.input_schema.variables &&
                    result.input_schema.variables.length > 0) ||
                    (result.output_schema &&
                      result.output_schema.outputs &&
                      result.output_schema.outputs.length > 0)) && (
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        onClick={() => setShowSchemas(!showSchemas)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">
                            {showSchemas
                              ? '📂 스키마 정보 숨기기'
                              : '📋 스키마 정보 보기'}
                          </span>
                          <span className="text-xs text-gray-500">
                            (입력/출력 변수)
                          </span>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform ${showSchemas ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* 스키마 정보 (토글) */}
                      {showSchemas && (
                        <div className="mt-4 space-y-4">
                          {/* Input Schema 정보 */}
                          {result.input_schema &&
                            result.input_schema.variables &&
                            result.input_schema.variables.length > 0 && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  📥 입력 변수 (Input Variables)
                                </label>
                                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                                  {result.input_schema.variables.map(
                                    (variable, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded border border-blue-200"
                                      >
                                        <code className="font-mono text-blue-700 font-semibold">
                                          {variable.name}
                                        </code>
                                        <span className="text-gray-400">:</span>
                                        <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                          {variable.type}
                                        </span>
                                        {variable.label &&
                                          variable.label !== variable.name && (
                                            <span className="text-gray-500 italic ml-auto">
                                              ({variable.label})
                                            </span>
                                          )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Output Schema 정보 */}
                          {result.output_schema &&
                            result.output_schema.outputs &&
                            result.output_schema.outputs.length > 0 && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  📤 출력 변수 (Output Variables)
                                </label>
                                <div className="bg-green-50 rounded-lg p-3 space-y-2">
                                  {result.output_schema.outputs.map(
                                    (output, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded border border-green-200"
                                      >
                                        <code className="font-mono text-green-700 font-semibold">
                                          {output.variable}
                                        </code>
                                        {output.label &&
                                          output.label !== output.variable && (
                                            <span className="text-gray-500 italic ml-auto">
                                              ({output.label})
                                            </span>
                                          )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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
    </>
  );
}
