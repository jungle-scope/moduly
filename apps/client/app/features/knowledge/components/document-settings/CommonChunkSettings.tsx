import React, { useState } from 'react';
import { Split, Settings, HelpCircle } from 'lucide-react';

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
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
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
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium py-1.5 px-3 -mx-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
          <Split className="w-4 h-4" />
          <h3>청크 설정</h3>
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            청크 크기
            <Tooltip text="하나의 정보 조각에 포함될 최대 글자 수입니다. (권장: 500~1000)" />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            오버랩
            <Tooltip text="정보 조각 간의 내용을 자연스럽게 연결하기 위해 중복되는 글자 수입니다." />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <input
              type="number"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              className="w-20 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            문단 구분자
            <Tooltip text="문서를 나눌 때 기준이 되는 문자입니다. (기본값: 줄바꿈 2번)" />
          </label>
          <input
            type="text"
            value={segmentIdentifier}
            onChange={(e) => setSegmentIdentifier(e.target.value)}
            placeholder="예: \\n\\n"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
          />
        </div>
      </section>
      {/* Preprocessing Settings Section */}
      <section className="space-y-1 mt-4">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium py-1.5 px-3 -mx-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
          <Settings className="w-4 h-4" />
          <h3>전처리 규칙</h3>
        </div>
        <div className="space-y-0">
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
              연속된 공백 및 줄바꿈 정리
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
