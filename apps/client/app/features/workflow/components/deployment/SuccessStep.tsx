'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, Clock, Globe } from 'lucide-react';
import { DeploymentResult, DeploymentType } from './types';
import { formatCronExpression } from './utils';

interface SuccessStepProps {
  result: DeploymentResult;
  deploymentType: DeploymentType;
  onClose: () => void;
}

export function SuccessStep({
  result,
  deploymentType,
  onClose,
}: SuccessStepProps) {
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('클립보드에 복사되었습니다!', { duration: 1000 });
  };

  // Generate URLs
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://moduly-ai.cloud';
  const frontendUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://moduly-ai.cloud';
  const API_URL = `${baseUrl}/api/v1/run/${result.url_slug}`;

  // Generate curl example
  const generateCurlExample = (): string => {
    let inputsExample: Record<string, string> = {};

    if (
      result.input_schema &&
      result.input_schema.variables &&
      result.input_schema.variables.length > 0
    ) {
      inputsExample = result.input_schema.variables.reduce(
        (acc, variable) => {
          acc[variable.name] = inputValues[variable.name] || '';
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    const inputsJson = JSON.stringify(inputsExample, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : `    ${line}`))
      .join('\n');

    const authHeader = result.auth_secret
      ? `  -H "Authorization: Bearer ${result.auth_secret.slice(0, 7)}${'\u2022'.repeat(result.auth_secret.length - 7)}" \\\n`
      : '';

    return `curl -X POST "${API_URL}" \\
  -H "Content-Type: application/json" \\
${authHeader}  -d '{
    "inputs": ${inputsJson}
  }'`;
  };

  // Handle test execution
  const handleTestExecute = async () => {
    setIsLoading(true);
    setTestResponse(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (result.auth_secret) {
        headers['Authorization'] = `Bearer ${result.auth_secret}`;
      }

      const response = await fetch(`/api/v1/run/${result.url_slug}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ inputs: inputValues }),
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));

      if (response.ok) {
        toast.success('테스트 실행 완료!', { duration: 1500 });
      } else {
        toast.error('API 호출 오류', { duration: 1500 });
      }
    } catch (error: any) {
      setTestResponse(JSON.stringify({ error: error.message }, null, 2));
      toast.error('테스트 실행 실패', { duration: 1500 });
    } finally {
      setIsLoading(false);
    }
  };

  // Webhook trigger detection
  const isWebhookTrigger =
    deploymentType === 'api' &&
    result.graph_snapshot?.nodes?.some((n: any) => n.type === 'webhookTrigger');

  return (
    <>
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
          <h2 className="text-xl font-bold">배포 성공 (v{result.version})</h2>
        </div>
        <p className="text-sm text-green-600 mt-1 ml-8">
          워크플로우가 성공적으로 배포되었습니다.
        </p>
      </div>

      <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Web App Share Link */}
        {result.webAppUrl && (
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              웹 앱 공유 링크
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

        {/* Widget Embedding Code */}
        {result.embedUrl && (
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <label className="block text-sm font-semibold text-purple-900 mb-2">
              웹사이트 임베딩 코드
            </label>
            <p className="text-xs text-purple-700 mb-3">
              아래 코드를 복사하여 웹사이트의{' '}
              <code className="bg-purple-200 px-1 rounded">&lt;/body&gt;</code>{' '}
              태그 직전에 붙여넣으세요!
            </p>
            <div className="relative">
              <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
                {`<script>
  window.ModulyConfig = {
    appId: '${result.url_slug}',
    frontendUrl: '${frontendUrl}'
  };
</script>
<script src="${baseUrl}/static/widget.js"></script>`}
              </pre>
              <button
                onClick={() =>
                  handleCopy(
                    `<script>
  window.ModulyConfig = {
    appId: '${result.url_slug}',
    frontendUrl: '${frontendUrl}'
  };
</script>
<script src="${baseUrl}/static/widget.js"></script>`,
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

        {/* Workflow Node Deployment */}
        {result.isWorkflowNode && (
          <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
            <label className="block text-sm font-semibold text-indigo-900 mb-2">
              서브 모듈 배포 완료
            </label>
            <p className="text-xs text-indigo-700 mb-3">
              이 워크플로우는 이제 다른 워크플로우에서 '서브 모듈'로 불러와
              사용할 수 있습니다.
            </p>
            <div className="bg-white p-3 rounded border border-indigo-200 text-sm text-gray-700">
              <p>
                <strong>버전:</strong> {result.version}
              </p>
            </div>
          </div>
        )}

        {/* Schedule Trigger Deployment */}
        {deploymentType === 'schedule' && result.cronExpression && (
          <div className="border border-violet-200 rounded-xl bg-gradient-to-br from-violet-50 to-white overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-violet-100 flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-violet-900">
                  스케줄링 활성화됨
                </h3>
                <p className="text-xs text-violet-500">
                  워크플로우가 자동으로 실행됩니다.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Primary Info: Natural Language Description */}
              <div>
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider block mb-1">
                  실행 주기
                </span>
                <p className="text-lg font-bold text-violet-900 leading-tight">
                  {formatCronExpression(result.cronExpression)}
                </p>
              </div>

              {/* Meta Info: Timezone */}
              <div>
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider block mb-1">
                  타임존
                </span>
                <div className="flex items-center gap-1.5 text-violet-700">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">{result.timezone}</span>
                </div>
              </div>

              {/* Secondary Info: Styled Cron Badge */}
              <div className="pt-4 border-t border-violet-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-violet-400 font-medium">
                    CRON EXPRESSION
                  </span>
                  <code className="text-[10px] font-mono font-medium text-violet-600 bg-violet-100/50 px-2 py-1 rounded border border-violet-200/50 tracking-wide">
                    {result.cronExpression}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Trigger Deployment */}
        {isWebhookTrigger && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - URL Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">웹훅 URL</h3>

              {/* Method 1: Integrated URL */}
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <label className="block text-sm font-semibold text-purple-900 mb-2">
                  방법 1: 통합 URL
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 p-3 bg-white border border-purple-300 rounded text-xs font-mono break-all">
                    {baseUrl}/api/v1/hooks/{result.url_slug}?token=
                    {result.auth_secret}
                  </code>
                  <button
                    onClick={() =>
                      handleCopy(
                        `${baseUrl}/api/v1/hooks/${result.url_slug}?token=${result.auth_secret}`,
                      )
                    }
                    className="p-3 hover:bg-purple-100 rounded transition-colors text-purple-700 border border-purple-200 h-full flex items-center justify-center"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Method 2: Standard API */}
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <label className="block text-sm font-semibold text-purple-900 mb-2">
                  방법 2: 표준 API
                </label>

                {/* URL */}
                <div className="mb-3">
                  <span className="text-xs font-semibold text-gray-700 block mb-1">
                    URL:
                  </span>
                  <div className="flex gap-2">
                    <code className="flex-1 p-2 bg-white border border-purple-300 rounded text-xs font-mono break-all">
                      {baseUrl}/api/v1/hooks/{result.url_slug}
                    </code>
                    <button
                      onClick={() =>
                        handleCopy(`${baseUrl}/api/v1/hooks/${result.url_slug}`)
                      }
                      className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 border border-gray-200"
                      title="Copy URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Auth Headers */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    인증 (Secret Key):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={result.auth_secret || ''}
                      readOnly
                      className="flex-1 px-2 py-1.5 text-xs border rounded bg-white font-mono"
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 border border-gray-200"
                      title={showSecret ? 'Hide' : 'Show'}
                    >
                      {showSecret ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(result.auth_secret || '')}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 border border-gray-200"
                      title="Copy Secret"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Integration Guide */}
            <div className="border-l border-gray-200 pl-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📖 웹훅 연동 방식 상세 안내
              </h3>
              <p className="text-xs text-gray-600 mb-6 leading-relaxed">
                사용하시는 외부 서비스의 보안 정책과 설정 환경에 맞춰 적절한
                방식을 선택하세요.
              </p>

              <div className="space-y-6">
                {/* Method 1 Guide */}
                <div>
                  <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    방식 1. 통합 URL (토큰 포함)
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-600 pl-3 border-l-2 border-gray-100 ml-1">
                    <li>
                      <span className="font-semibold text-gray-700">특징:</span>{' '}
                      URL 경로 끝에 인증 토큰(<code>?token=...</code>)이 미리
                      포함되어 있는 형태입니다.
                    </li>
                    <li>
                      <span className="font-semibold text-gray-700">용도:</span>{' '}
                      별도의 HTTP 헤더(Header)를 설정할 수 없고 URL 하나만 입력
                      가능한 환경 (예: 단순 알림 봇, 노코드 툴 등)에 최적화되어
                      있습니다.
                    </li>
                    <li className="text-orange-600 bg-orange-50 p-2 rounded">
                      <span className="font-bold">⚠️ 주의:</span> URL 자체가
                      인증 키 역할을 하므로, 외부에 노출되지 않도록 주의가
                      필요합니다.
                    </li>
                  </ul>
                </div>

                {/* Method 2 Guide */}
                <div>
                  <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    방식 2. 표준 API (보안 권장)
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-600 pl-3 border-l-2 border-gray-100 ml-1">
                    <li>
                      <span className="font-semibold text-gray-700">특징:</span>{' '}
                      접속 URL과 인증용 Secret Key가 엄격히 분리된 엔터프라이즈
                      표준 방식입니다.
                    </li>
                    <li>
                      <span className="font-semibold text-gray-700">용도:</span>{' '}
                      GitHub, Jira 등 보안과 운영 안정성이 중요한 서비스 연동 시
                      권장합니다.
                    </li>
                    <li className="text-blue-600 bg-blue-50 p-2 rounded">
                      <span className="font-semibold">👍 장점:</span> HTTP
                      Header를 통해 인증을 수행하므로 통신 로그에 토큰이 남지
                      않아 보안성이 훨씬 높습니다.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REST API Deployment (exclude webhooks) */}
        {!result.webAppUrl &&
          !result.embedUrl &&
          !result.isWorkflowNode &&
          deploymentType !== 'schedule' &&
          !isWebhookTrigger && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - API Information */}
              <div className="space-y-4">
                {/* API Endpoint */}
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

                {/* API Secret Key */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    API Secret Key
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 font-mono break-all leading-relaxed">
                      {result.auth_secret
                        ? `${result.auth_secret.slice(0, 7)}${'•'.repeat(result.auth_secret.length - 7)}`
                        : 'N/A (Public)'}
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

                {/* Input Variables Section */}
                {result.input_schema &&
                  result.input_schema.variables &&
                  result.input_schema.variables.length > 0 && (
                    <div>
                      {/* Section Header */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">
                            입력 변수
                          </span>
                          <span className="text-xs text-gray-500">
                            ({result.input_schema.variables.length}개)
                          </span>
                        </div>
                      </div>

                      {/* Scrollable Input Variables Form */}
                      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
                        {result.input_schema.variables.map(
                          (variable, index) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                            >
                              {/* Variable Info Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono text-blue-700 font-semibold">
                                    {variable.name}
                                  </code>
                                  <span
                                    className={`text-xs px-2 py-1 rounded font-medium ${
                                      variable.required
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}
                                  >
                                    {variable.required ? '필수' : '선택'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded font-medium">
                                    {variable.type}
                                  </span>
                                </div>
                              </div>

                              {/* Input Field */}
                              <input
                                type={
                                  variable.type === 'number' ? 'number' : 'text'
                                }
                                placeholder={`${variable.label || variable.name} 입력`}
                                value={inputValues[variable.name] || ''}
                                onChange={(e) =>
                                  setInputValues({
                                    ...inputValues,
                                    [variable.name]: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </div>

              {/* Right Column - Test Tools */}
              <div className="space-y-4 border-l border-gray-200 pl-6">
                {/* cURL Example */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Test Command (cURL)
                  </label>
                  <div className="relative">
                    <pre className="p-4 bg-gray-900 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
                      {generateCurlExample()}
                    </pre>
                    <button
                      onClick={() => handleCopy(generateCurlExample())}
                      className="absolute top-2 right-2 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      복사
                    </button>
                  </div>
                </div>

                {/* Test Execution Button */}
                <button
                  onClick={handleTestExecute}
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
                    isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? '실행 중...' : '테스트 실행'}
                </button>

                {/* Response Result */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    응답 결과
                  </label>
                  {testResponse ? (
                    <div className="relative">
                      <pre className="p-4 bg-gray-900 rounded-lg text-xs text-green-400 font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-700 max-h-[250px] overflow-y-auto">
                        {testResponse}
                      </pre>
                      <button
                        onClick={() => handleCopy(testResponse)}
                        className="absolute top-2 right-2 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      >
                        복사
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg min-h-[100px] flex items-center justify-center">
                      <p className="text-sm text-gray-500">
                        테스트 실행 후 결과가 여기에 표시됩니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
        >
          확인
        </button>
      </div>
    </>
  );
}
