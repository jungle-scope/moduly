import React, { useState } from 'react';
import { FileJson, HelpCircle } from 'lucide-react';

interface ParsingStrategySettingsProps {
  strategy: 'general' | 'llamaparse';
  setStrategy: (val: 'general' | 'llamaparse') => void;
}

// Tooltip Component (CommonChunkSettings와 동일)
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
  return (
    <section className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium py-1.5 px-3 -mx-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
        <FileJson className="w-4 h-4" />
        <h3>분석 방식</h3>
      </div>

      {/* Segmented Control */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setStrategy('general')}
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
          onClick={() => setStrategy('llamaparse')}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 relative ${
            strategy === 'llamaparse'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Pro
          <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded">
            추천
          </span>
          <Tooltip text="이미지, 표, 복잡한 레이아웃을 정확하게 인식합니다. API 키가 필요해요." />
        </button>
      </div>
    </section>
  );
}
