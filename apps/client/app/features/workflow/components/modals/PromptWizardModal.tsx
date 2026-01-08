'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, Loader2, ArrowRight, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PromptWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptType: 'system' | 'user' | 'assistant';
  originalPrompt: string;
  onApply: (improvedPrompt: string) => void;
}

const PROMPT_TYPE_LABELS = {
  system: 'System Prompt',
  user: 'User Prompt',
  assistant: 'Assistant Prompt',
};

export function PromptWizardModal({
  isOpen,
  onClose,
  promptType,
  originalPrompt,
  onApply,
}: PromptWizardModalProps) {
  const router = useRouter();
  
  const [currentPrompt, setCurrentPrompt] = useState(originalPrompt);
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // 모달 열릴 때 credential 확인 및 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentPrompt(originalPrompt);
      setImprovedPrompt('');
      setError(null);
      setCopied(false);
      checkCredentials();
    }
  }, [isOpen, originalPrompt]);

  const checkCredentials = async () => {
    try {
      const res = await fetch('/api/v1/prompt-wizard/check-credentials', {
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

  const handleImprove = async () => {
    if (!currentPrompt.trim()) {
      setError('개선할 프롬프트를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImprovedPrompt('');

    try {
      const res = await fetch('/api/v1/prompt-wizard/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt_type: promptType,
          original_prompt: currentPrompt,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const message = errorData.detail?.message || errorData.detail || '프롬프트 개선에 실패했습니다.';
        throw new Error(message);
      }

      const data = await res.json();
      setImprovedPrompt(data.improved_prompt);
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (improvedPrompt) {
      setCurrentPrompt(improvedPrompt);
      onApply(improvedPrompt);
      onClose();
    }
  };

  const handleCopy = async () => {
    if (improvedPrompt) {
      await navigator.clipboard.writeText(improvedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToProviderSettings = () => {
    onClose();
    router.push('/settings/provider');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[60vh] min-h-[450px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                프롬프트 마법사
              </h2>
              <p className="text-sm text-gray-500">
                {PROMPT_TYPE_LABELS[promptType]}
              </p>
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
            이 기능은 등록하신 Provider API Key를 통해 AI를 호출하며, 호출 시 소량의 토큰 비용이 발생할 수 있습니다.
          </p>
        </div>

        {/* Body - 2열 레이아웃 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽: 원본 프롬프트 */}
          <div className="w-1/2 p-5 border-r border-gray-200 flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-2">
              원본 프롬프트
            </label>
            <textarea
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.target.value)}
              placeholder="개선할 프롬프트를 입력하세요..."
              className="flex-1 w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            
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
                  onClick={handleImprove}
                  disabled={isLoading || !currentPrompt.trim()}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI가 개선 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      프롬프트 개선 요청
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: AI 개선 결과 */}
          <div className="w-1/2 p-5 flex flex-col bg-gray-50">
            <label className="text-sm font-semibold text-gray-700 mb-2">
              AI 개선 결과
            </label>
            
            <div className="flex-1 w-full p-3 text-sm border border-gray-200 rounded-lg bg-white overflow-y-auto">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                  <p className="text-sm">AI가 프롬프트를 분석하고 있습니다...</p>
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                </div>
              ) : improvedPrompt ? (
                <pre className="whitespace-pre-wrap font-sans text-gray-700">
                  {improvedPrompt}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  왼쪽에서 "프롬프트 개선 요청" 버튼을 클릭하세요
                </div>
              )}
            </div>

            {/* 오른쪽 하단 버튼 영역 */}
            {improvedPrompt && (
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
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <Check className="w-4 h-4" />
                  이 프롬프트 적용
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
