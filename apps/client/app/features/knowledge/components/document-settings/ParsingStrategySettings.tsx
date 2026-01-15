import React, { useState, useEffect } from 'react';
import { FileJson, HelpCircle, Lock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useGenericCredential } from '../../hooks/useGenericCredential';

interface ParsingStrategySettingsProps {
  strategy: 'general' | 'llamaparse';
  setStrategy: (val: 'general' | 'llamaparse') => void;
}

// Tooltip Component
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const spanRef = React.useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  return (
    <>
      <span
        ref={spanRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </span>
      {show && (
        <div
          className="fixed z-[9999] w-56 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ top: position.top, left: position.left }}
        >
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}
    </>
  );
}

export default function ParsingStrategySettings({
  strategy,
  setStrategy,
}: ParsingStrategySettingsProps) {
  const { hasKey, isLoading } = useGenericCredential('llamaparse');
  const [showWarning, setShowWarning] = useState(false);
  const [shake, setShake] = useState(false);

  // strategy가 llamaparse인데 키가 없으면 경고 표시 (초기 진입 시)
  useEffect(() => {
    if (!isLoading && !hasKey && strategy === 'llamaparse') {
      setShowWarning(true);
    } else if (hasKey) {
      setShowWarning(false);
    }
  }, [isLoading, hasKey, strategy]);

  const handleProClick = () => {
    setStrategy('llamaparse');
    if (!hasKey) {
      setShowWarning(true);
      setShake(true);
      setTimeout(() => setShake(false), 500); // 흔들림 효과 리셋
    } else {
      setShowWarning(false);
    }
  };

  return (
    <section className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium py-1.5 px-3 -mx-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
        <FileJson className="w-4 h-4" />
        <h3>분석 방식</h3>
      </div>

      {/* Segmented Control */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 relative">
        <button
          type="button"
          onClick={() => {
            setStrategy('general');
            setShowWarning(false);
          }}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
            strategy === 'general'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Basic
          <Tooltip text="텍스트 중심의 간단한 문서에 적합합니다. 별도 비용 없이 사용할 수 있어요." />
        </button>
        <button
          type="button"
          onClick={handleProClick}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 relative ${
            strategy === 'llamaparse'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          } ${shake ? 'animate-shake' : ''}`}
        >
          Pro
          {!hasKey && !isLoading && (
            <Lock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          )}
          <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded">
            추천
          </span>
          <Tooltip text="이미지, 표, 복잡한 레이아웃을 정확하게 인식합니다. API 키가 필요해요." />
        </button>
      </div>

      {/* Inline Warning Card (Modern & Smooth) */}
      {showWarning && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3">
            <div className="flex items-start gap-2.5">
              <div className="bg-amber-100 dark:bg-amber-800/40 p-1.5 rounded-full shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  🔒 API Key 설정이 필요합니다
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  <a
                    href="https://cloud.llamaindex.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    LlamaCloud ↗
                  </a>
                  에서 키 발급 후,{' '}
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-0.5 text-gray-800 dark:text-gray-200 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2"
                  >
                    설정 페이지
                  </Link>
                  에 등록해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
