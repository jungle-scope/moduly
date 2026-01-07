import React from 'react';
import Link from 'next/link';
import { FileJson, ChevronRight } from 'lucide-react';
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
        <h3>분석 방식 설정</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* 일반 파싱 옵션: general */}
        <label
          className={`relative flex flex-col p-3 cursor-pointer rounded-lg border-2 transition-all h-full ${
            strategy === 'general'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="block text-sm font-bold text-gray-900 dark:text-white">
              Basic (기본)
            </span>
            <input
              type="radio"
              name="strategy"
              value="general"
              checked={strategy === 'general'}
              onChange={() => setStrategy('general')}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex-1">
            텍스트 위주의 단순 문서용
          </p>
          <div>
            <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded border border-gray-200 dark:border-gray-600">
              무료
            </span>
          </div>
        </label>

        {/* 정밀 파싱 옵션 : llamaParse (Disabled) */}
        {/* 정밀 파싱 옵션 : llamaParse (Enabled) */}
        <div
          onClick={() => setStrategy('llamaparse')}
          className={`relative flex flex-col p-3 cursor-pointer rounded-lg border-2 transition-all h-full ${
            strategy === 'llamaparse'
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="block text-sm font-bold text-gray-900 dark:text-white">
              Pro (정밀)
            </span>
            <input
              type="radio"
              name="strategy"
              value="llamaparse"
              checked={strategy === 'llamaparse'}
              onChange={() => {}} // onClick on parent handles this
              className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 pointer-events-none"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex-1">
            이미지/표 인식 고급 분석
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded border border-indigo-200 dark:border-indigo-800">
              추천
            </span>
            <Link
              href="/settings/provider"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-medium z-10"
            >
              API 설정 <ChevronRight className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 leading-relaxed">
        <p>
          💡 <strong>Tip:</strong> 문서에 표나 이미지가 많다면{' '}
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
            Pro
          </span>{' '}
          모드를 추천합니다. 텍스트 위주는 Basic으로도 충분해요.
        </p>
      </div>
    </section>
  );
}
