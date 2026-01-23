'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Wand2,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  Info,
  Code,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 서버 에러 응답 타입 정의 (개선점 1: 에러 스키마 명확화)
interface ApiErrorResponse {
  detail: string | { message: string };
}

// 에러 메시지 추출 헬퍼 함수
function extractErrorMessage(errorData: unknown): string {
  if (
    typeof errorData === 'object' &&
    errorData !== null &&
    'detail' in errorData
  ) {
    const detail = (errorData as ApiErrorResponse).detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail !== null && 'message' in detail) {
      return detail.message;
    }
  }
  return '코드 생성에 실패했습니다.';
}

interface CodeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputVariables: string[]; // 현재 Code Node에 정의된 입력 변수 목록
  onApply: (generatedCode: string) => void;
}

export function CodeWizardModal({
  isOpen,
  onClose,
  inputVariables,
  onApply,
}: CodeWizardModalProps) {
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // 모달 열릴 때 credential 확인 및 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setGeneratedCode('');
      setError(null);
      setCopied(false);
      checkCredentials();
    }
  }, [isOpen]);

  const checkCredentials = async () => {
    try {
      const res = await fetch('/api/v1/code-wizard/check-credentials', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHasCredentials(data.has_credentials);
      }
    } catch {
      setHasCredentials(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('생성할 코드에 대한 설명을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedCode('');

    try {
      const res = await fetch('/api/v1/code-wizard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: description,
          input_variables: inputVariables,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(extractErrorMessage(errorData));
      }

      const data = await res.json();
      setGeneratedCode(data.generated_code);
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (generatedCode) {
      onApply(generatedCode);
      onClose();
    }
  };

  const handleCopy = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToProviderSettings = () => {
    window.open('/dashboard/settings', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[65vh] min-h-[500px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wand2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">코드 마법사</h2>
              <p className="text-sm text-gray-500">자연어로 Python 코드 생성</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 비용 안내 문구 */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            이 기능은 등록하신 Provider API Key를 통해 AI를 호출하며, 호출 시
            소량의 토큰 비용이 발생할 수 있습니다.
          </p>
        </div>

        {/* Body - 2열 레이아웃 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽: 설명 입력 */}
          <div className="w-1/2 p-5 border-r border-gray-200 flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-2">
              원하는 기능 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 입력 변수 num1, num2를 더해 반환&#10;예: 텍스트에서 이메일 주소 추출 (변수명: raw_data)&#10;예: JSON 문자열을 파싱해 특정 필드 반환 (json 변수명: payload, 필드명: name)&#10;예: 입력 변수가 없다면 숫자 1과 4를 더해 반환"
              className="flex-1 w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />

            {/* 입력 변수 미리보기 */}
            {inputVariables.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  사용 가능한 입력 변수
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inputVariables.map((v, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded font-mono"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 왼쪽 하단 버튼 영역 */}
            <div className="mt-4">
              {hasCredentials === false ? (
                <button
                  onClick={goToProviderSettings}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Provider 등록하러 가기
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !description.trim()}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI가 코드 생성 중...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      코드 생성 요청
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 생성된 코드 */}
          <div className="w-1/2 p-5 flex flex-col bg-gray-50">
            <label className="text-sm font-semibold text-gray-700 mb-2">
              생성된 코드
            </label>

            <div className="flex-1 w-full text-sm border border-gray-200 rounded-lg bg-gray-900 overflow-y-auto">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-500" />
                  <p className="text-sm">AI가 코드를 생성하고 있습니다...</p>
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              ) : generatedCode ? (
                <SyntaxHighlighter
                  language="python"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '12px',
                    background: 'transparent',
                  }}
                  wrapLongLines
                >
                  {generatedCode}
                </SyntaxHighlighter>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  왼쪽에서 "코드 생성 요청" 버튼을 클릭하세요
                </div>
              )}
            </div>

            {/* 오른쪽 하단 버튼 영역 */}
            {generatedCode && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 px-4 border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      복사
                    </>
                  )}
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <Check className="w-4 h-4" />이 코드 적용
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
