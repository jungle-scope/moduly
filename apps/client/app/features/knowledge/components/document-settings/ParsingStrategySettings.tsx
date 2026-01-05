import React from 'react';
import { FileJson, Zap } from 'lucide-react';
import Link from 'next/link';
interface ParsingStrategySettingsProps {
  strategy: 'general' | 'llamaparse';
  setStrategy: (val: 'general' | 'llamaparse') => void;
}
export default function ParsingStrategySettings({
  strategy,
  setStrategy,
}: ParsingStrategySettingsProps) {
  return (
    <section className="space-y-4 mb-8">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
        <FileJson className="w-4 h-4" />
        <h3>파싱 방법</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {/* 일반 파싱 옵션: general */}
        <label
          className={`relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all ${
            strategy === 'general'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <input
            type="radio"
            name="strategy"
            value="general"
            checked={strategy === 'general'}
            onChange={() => setStrategy('general')}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="ml-3">
            <span className="block text-sm font-medium text-gray-900 dark:text-white">
              일반 파싱
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              무료, 빠른 속도. 텍스트 위주의 문서에 적합합니다.
            </span>
            <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] rounded">
              무료
            </span>
          </div>
        </label>
        {/* 정밀 파싱 옵션 : llamaParse */}
        <label
          className={`relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all ${
            strategy === 'llamaparse'
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <input
            type="radio"
            name="strategy"
            value="llamaparse"
            checked={strategy === 'llamaparse'}
            onChange={() => setStrategy('llamaparse')}
            className="mt-1 w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
          />
          <div className="ml-3">
            <span className="block text-sm font-medium text-gray-900 dark:text-white">
              정밀 파싱
            </span>
            <Link
              href="/settings/provider"
              target="_blank"
              className="text-[10px] text-gray-500 hover:text-blue-600 underline decoration-dotted transition-colors"
            >
              API Key 등록
            </Link>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              이미지, 표, 복잡한 레이아웃을 정확하게 인식합니다.
            </span>
            <div className="flex gap-2 mt-2 items-center">
              <span className="inline-block px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 text-[10px] rounded flex items-center gap-1">
                <Zap className="w-3 h-3" /> 유료
              </span>
            </div>
          </div>
        </label>
      </div>
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 leading-relaxed">
        <p>
          💡 <strong>Tip:</strong> 문서에 표나 이미지가 많다면{' '}
          <span className="text-yellow-600 font-medium">정밀 파싱</span>을
          사용하세요. 단순 텍스트 문서는 일반 파싱으로도 충분합니다.
        </p>
      </div>
    </section>
  );
}
