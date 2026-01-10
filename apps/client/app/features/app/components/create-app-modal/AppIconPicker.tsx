import React, { useEffect, useRef } from 'react';
import { AppIconSelection } from './types';

type Props = {
  currentIcon: AppIconSelection; // 현재 선택된 아이콘 정보
  onSelect: (icon: AppIconSelection) => void; // 아이콘 변경 시 호출될 콜백
  onClose: () => void; // 선택기 닫기 콜백
};

// 선택 가능한 이모지 목록
const EMOJIS = [
  '📚',
  '🚀',
  '🌟',
  '🤖',
  '🔧',
  '🎨',
  '📈',
  '💬',
  '🧠',
  '💡',
  '🔍',
  '📊',
];

// 선택 가능한 배경색 목록
const COLORS = [
  '#D1E9FF',
  '#FFEAD5',
  '#D4F7D4',
  '#FFE8E8',
  '#E8D4FF',
  '#FFFDD1',
  '#E0F7FA',
  '#FCE4EC',
  '#F3E5F5',
  '#E1F5FE',
  '#E8F5E9',
  '#FFF3E0',
];

/**
 * 앱 아이콘 선택기 (Picker)
 *
 * 사용자가 아이콘의 이모지와 배경색을 선택할 수 있는 팝업 메뉴입니다.
 */
export const AppIconPicker = ({ currentIcon, onSelect, onClose }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지 (Outside Click Detection)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 팝업 외부를 클릭했을 때 닫기
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-14 left-0 z-50 p-4 bg-white rounded-xl shadow-2xl border border-zinc-200 w-80 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="space-y-4">
        {/* 이모지 선택 섹션 */}
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            이모지 (Emoji)
          </span>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect({ ...currentIcon, emoji })}
                className={`flex items-center justify-center h-9 w-9 text-lg rounded-md hover:bg-zinc-100 transition-colors ${
                  currentIcon.emoji === emoji
                    ? 'bg-blue-50 ring-2 ring-blue-500' // 선택된 상태 스타일
                    : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 배경색 선택 섹션 */}
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            배경색 (Color)
          </span>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {COLORS.map((bg) => (
              <button
                key={bg}
                onClick={() => onSelect({ ...currentIcon, bg })}
                className={`h-9 w-9 rounded-md cursor-pointer transition-transform hover:scale-105 ${
                  currentIcon.bg === bg
                    ? 'ring-2 ring-blue-500 ring-offset-2' // 선택된 상태 스타일
                    : 'ring-1 ring-zinc-100'
                }`}
                style={{ backgroundColor: bg }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
