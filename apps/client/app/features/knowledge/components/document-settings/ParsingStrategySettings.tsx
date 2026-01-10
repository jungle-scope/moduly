import React from 'react';
import { FileJson, HelpCircle } from 'lucide-react';

interface ParsingStrategySettingsProps {
  strategy: 'general' | 'llamaparse';
  setStrategy: (val: 'general' | 'llamaparse') => void;
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
          title="텍스트 위주의 단순 문서용 (무료)"
        >
          Basic
          <HelpCircle className="w-3 h-3 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => setStrategy('llamaparse')}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 relative ${
            strategy === 'llamaparse'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          title="이미지/표 인식 고급 분석 (API 키 필요)"
        >
          Pro
          <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded">
            추천
          </span>
          <HelpCircle className="w-3 h-3 text-gray-400" />
        </button>
      </div>
    </section>
  );
}
