import React from 'react';
import { Split, Settings } from 'lucide-react';

interface CommonChunkSettingsProps {
  chunkSize: number;
  setChunkSize: (val: number) => void;
  chunkOverlap: number;
  setChunkOverlap: (val: number) => void;
  segmentIdentifier: string;
  setSegmentIdentifier: (val: string) => void;
  removeWhitespace: boolean;
  setRemoveWhitespace: (val: boolean) => void;
  removeUrlsEmails: boolean;
  setRemoveUrlsEmails: (val: boolean) => void;
}

export default function CommonChunkSettings({
  chunkSize,
  setChunkSize,
  chunkOverlap,
  setChunkOverlap,
  segmentIdentifier,
  setSegmentIdentifier,
  removeWhitespace,
  setRemoveWhitespace,
  removeUrlsEmails,
  setRemoveUrlsEmails,
}: CommonChunkSettingsProps) {
  return (
    <>
      {/* 청크 세팅 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
          <Split className="w-4 h-4" />
          <h3>청킹 설정 (Chunking)</h3>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Chunk Size
          </label>
          <input
            type="number"
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <p className="text-xs text-gray-500">
            한 청크에 포함될 최대 글자 수입니다.
          </p>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Chunk Overlap
          </label>
          <input
            type="number"
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <p className="text-xs text-gray-500">
            청크 간 중첩되는 글자 구간입니다.
          </p>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Segment Identifier
          </label>
          <input
            type="text"
            value={segmentIdentifier}
            onChange={(e) => setSegmentIdentifier(e.target.value)}
            placeholder="예: \n\n"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
          />
          <p className="text-xs text-gray-500">문단을 구분하는 문자입니다.</p>
        </div>
      </section>
      {/* Preprocessing Settings Section */}
      <section className="space-y-4 mt-8">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
          <Settings className="w-4 h-4" />
          <h3>전처리 규칙</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={removeWhitespace}
                onChange={(e) => setRemoveWhitespace(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              공백/줄바꿈 정리
            </span>
          </label>
          <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={removeUrlsEmails}
                onChange={(e) => setRemoveUrlsEmails(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              URL 및 이메일 제거
            </span>
          </label>
        </div>
      </section>
    </>
  );
}
