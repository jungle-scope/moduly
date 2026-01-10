import React, { useState } from 'react';
import { FileJson, HelpCircle } from 'lucide-react';

interface ParsingStrategySettingsProps {
  strategy: 'general' | 'llamaparse';
  setStrategy: (val: 'general' | 'llamaparse') => void;
}

// Tooltip Component
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <HelpCircle className="w-3 h-3" />
      </button>
      {show && (
        <div
          className="fixed z-[9999] w-48 px-2.5 py-1.5 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full pointer-events-none"
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
          <Tooltip text="텍스트 위주의 단순 문서용 (무료)" />
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
          <Tooltip text="이미지/표 인식 고급 분석 (API 키 필요)" />
        </button>
      </div>
    </section>
  );
}
