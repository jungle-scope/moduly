'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, Loader2, ArrowRight, Info, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 템플릿 타입 정의
type TemplateType = 'email' | 'message' | 'report' | 'custom';

interface TemplateWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalTemplate: string;
  registeredVariables: string[];  // Template Node의 등록된 변수명
  onApply: (improvedTemplate: string) => void;
}

const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'email', label: '이메일/알림', description: '이메일, 뉴스레터, 알림 템플릿' },
  { value: 'message', label: '챗봇/메시지', description: '챗봇 응답, 알림 메시지' },
  { value: 'report', label: '보고서/문서', description: '보고서, 문서, 마크다운' },
  { value: 'custom', label: '직접 설명', description: '원하는 개선 방향을 직접 설명' },
];

export function TemplateWizardModal({
  isOpen,
  onClose,
  originalTemplate,
  registeredVariables,
  onApply,
}: TemplateWizardModalProps) {
  const router = useRouter();
  
  // 상태 관리
  const [currentTemplate, setCurrentTemplate] = useState(originalTemplate);
  const [improvedTemplate, setImprovedTemplate] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('email');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentTemplate(originalTemplate);
      setImprovedTemplate('');
      setError(null);
      setCopied(false);
      setTemplateType('email');
      setCustomInstructions('');
      checkCredentials();
    }
  }, [isOpen, originalTemplate]);

  // Credential 확인
  const checkCredentials = async () => {
    try {
      const res = await fetch('/api/v1/template-wizard/check-credentials', {
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

  // 템플릿 개선 요청
  const handleImprove = async () => {
    if (!currentTemplate.trim()) {
      setError('개선할 템플릿을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImprovedTemplate('');

    try {
      const res = await fetch('/api/v1/template-wizard/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          template_type: templateType,
          original_template: currentTemplate,
          registered_variables: registeredVariables,
          custom_instructions: templateType === 'custom' ? customInstructions : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const message = errorData.detail?.message || errorData.detail || '템플릿 개선에 실패했습니다.';
        throw new Error(message);
      }

      const data = await res.json();
      setImprovedTemplate(data.improved_template);
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 개선된 템플릿 적용
  const handleApply = () => {
    if (improvedTemplate) {
      setCurrentTemplate(improvedTemplate);
      onApply(improvedTemplate);
      onClose();
    }
  };

  // 복사
  const handleCopy = async () => {
    if (improvedTemplate) {
      await navigator.clipboard.writeText(improvedTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Provider 설정 페이지 이동
  const goToProviderSettings = () => {
    onClose();
    router.push('/settings/provider');
  };

  if (!isOpen) return null;

  const selectedType = TEMPLATE_TYPE_OPTIONS.find(t => t.value === templateType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[70vh] min-h-[550px] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-pink-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                템플릿 마법사
              </h2>
              <p className="text-sm text-gray-500">
                Jinja2 템플릿 개선
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

        {/* 비용 안내 + 변수 안내 */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            등록하신 Provider API Key를 통해 AI를 호출합니다. 
            {registeredVariables.length > 0 && (
              <span className="ml-1">
                등록된 변수: <code className="bg-amber-100 px-1 rounded">{registeredVariables.join(', ')}</code>
              </span>
            )}
          </p>
        </div>

        {/* 템플릿 타입 선택 */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">템플릿 유형:</span>
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[160px]"
              >
                <span className="text-sm font-medium text-gray-800">{selectedType?.label}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
              </button>
              
              {showTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {TEMPLATE_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTemplateType(option.value);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        templateType === option.value ? 'bg-pink-50' : ''
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-800">{option.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* custom 타입일 때 추가 설명 입력 */}
          {templateType === 'custom' && (
            <div className="mt-3">
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="예: 친근한 톤으로, 이모지를 추가해서, 더 간결하게..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 본문 - 2열 레이아웃 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽: 원본 템플릿 */}
          <div className="w-1/2 p-5 border-r border-gray-200 flex flex-col">
            <label className="text-sm font-semibold text-gray-700 mb-2">
              원본 템플릿
            </label>
            <textarea
              value={currentTemplate}
              onChange={(e) => setCurrentTemplate(e.target.value)}
              placeholder="개선할 Jinja2 템플릿을 입력하세요...&#10;예: 안녕하세요, {{ user_name }}님!"
              className="flex-1 w-full p-3 text-sm font-mono border border-gray-300 rounded-lg resize-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 focus:outline-none"
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
                  disabled={isLoading || !currentTemplate.trim()}
                  className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI가 개선 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      템플릿 개선 요청
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
            
            <div className="flex-1 w-full p-3 text-sm border border-gray-200 rounded-lg bg-white overflow-y-auto font-mono">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-pink-500" />
                  <p className="text-sm">AI가 템플릿을 분석하고 있습니다...</p>
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                </div>
              ) : improvedTemplate ? (
                <pre className="whitespace-pre-wrap font-mono text-gray-700">
                  {improvedTemplate}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  왼쪽에서 "템플릿 개선 요청" 버튼을 클릭하세요
                </div>
              )}
            </div>

            {/* 오른쪽 하단 버튼 영역 */}
            {improvedTemplate && (
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
                  className="flex-1 py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <Check className="w-4 h-4" />
                  이 템플릿 적용
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
