'use client';

import React, { useState, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import { Columns } from 'lucide-react';

interface ColumnAutocompleteProps {
  selectedColumns: Record<string, string[]>; // {table: [columns]}
  value: string;
  onChange: (value: string) => void;
  onAliasGenerate?: (table: string, column: string, alias: string) => void;
  placeholder?: string;
  className?: string;
}

interface AutocompleteItem {
  table: string;
  column: string;
  fullName: string; // "table.column"
}

export default function ColumnAutocomplete({
  selectedColumns,
  value,
  onChange,
  onAliasGenerate,
  placeholder,
  className = '',
}: ColumnAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0); // 커서 위치 저장

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 선택된 모든 컬럼 목록
  const allColumns: AutocompleteItem[] = Object.entries(
    selectedColumns,
  ).flatMap(([table, columns]) =>
    columns.map((column) => ({
      table,
      column,
      fullName: `${table}.${column}`,
    })),
  );

  // 드롭다운 위치 계산 (커서 위치 기반)
  const calculateDropdownPosition = (text: string, cursorPos: number) => {
    // react-simple-code-editor의 내부 textarea 찾기
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    // 1. Mirror Div 생성 (스타일 복제용)
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);

    // 필수 스타일 복사
    Array.from(style).forEach((prop) => {
      div.style.setProperty(
        prop,
        style.getPropertyValue(prop),
        style.getPropertyPriority(prop),
      );
    });

    // Mirror Div 설정
    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '-9999px'; // 화면 밖으로 숨김
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = style.width;
    div.style.height = 'auto';

    // 2. 커서 앞까지의 텍스트 복사 및 좌표 계산용 span 추가
    const textBeforeCursor = text.substring(0, cursorPos);
    div.textContent = textBeforeCursor;

    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);

    document.body.appendChild(div);

    // 3. 좌표 계산
    const rect = textarea.getBoundingClientRect();
    const spanOffsetTop = span.offsetTop;
    const spanOffsetLeft = span.offsetLeft;

    // 줄 높이 보정 (커서 바로 아래)
    const lineHeight = parseFloat(style.lineHeight) || 20;

    let left =
      rect.left + window.scrollX + spanOffsetLeft - textarea.scrollLeft;
    const top =
      rect.top +
      window.scrollY +
      spanOffsetTop +
      lineHeight -
      textarea.scrollTop;

    // 화면 경계 보정 (Horizontal Adjustment)
    const dropdownMaxWidth = 500; // w-[480px] + padding margin
    const viewportWidth = window.innerWidth;
    const margin = 20; // 스크롤바 등 여유 공간

    if (left + dropdownMaxWidth > viewportWidth) {
      // 화면 오른쪽을 넘어가면, 화면 오른쪽 끝에 맞춤 (여유 공간 제외)
      left = Math.max(margin, viewportWidth - dropdownMaxWidth - margin);
    }

    setDropdownPosition({ top, left });

    document.body.removeChild(div);
  };

  // {{ 감지 및 자동완성
  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    // react-simple-code-editor의 내부 textarea 찾기
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    setCursorPosition(cursorPos); // 커서 위치 저장

    const textBeforeCursor = newValue.substring(0, cursorPos);

    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
    const lastCloseBrace = textBeforeCursor.lastIndexOf('}}');

    if (lastOpenBrace > lastCloseBrace && lastOpenBrace !== -1) {
      const searchTerm = textBeforeCursor.substring(lastOpenBrace + 2).trim();

      const filtered = allColumns.filter(
        (item) =>
          item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.column.toLowerCase().includes(searchTerm.toLowerCase()),
      );

      setFilteredItems(filtered);
      setSelectedIndex(-1);
      setShowDropdown(filtered.length > 0);

      // 드롭다운 위치 계산
      if (filtered.length > 0) {
        calculateDropdownPosition(newValue, cursorPos);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // 아이템 선택
  const selectItem = (item: AutocompleteItem) => {
    // 저장된 커서 위치 사용
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);

    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
    const beforeBrace = value.substring(0, lastOpenBrace);

    // 스마트 별칭 생성 로직
    let finalAlias = item.column;
    const isCollision = allColumns.some(
      (col) => col.table !== item.table && col.column === item.column,
    );

    if (isCollision) {
      finalAlias = `${item.table}_${item.column}`;
    }

    const newValue = `${beforeBrace}{{${finalAlias}}}${textAfterCursor}`;
    onChange(newValue);

    // Alias 자동 생성 및 저장
    if (onAliasGenerate) {
      onAliasGenerate(item.table, item.column, finalAlias);
    }

    // 커서 위치 조정
    const newCursorPos = beforeBrace.length + finalAlias.length + 4;
    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea',
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }
    }, 0);

    setShowDropdown(false);
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < 1 ? filteredItems.length - 1 : prev - 1,
      );
    } else if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      selectItem(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  // 커스텀 하이라이팅 함수
  const highlightCode = (code: string) => {
    // {{...}} 패턴을 찾아서 span으로 감싸기
    return code.replace(
      /(\{\{[^}]+\}\})/g,
      '<span style="display: inline-block; background-color: #ffffff; border: 0 solid #d1d5db; border-radius: 3px; padding: 0; margin: 0;"><span style="display: inline-block; transform: scale(0.95); transform-origin: center; color: #2254F5; font-weight: 600;">$1</span></span>',
    );
  };

  return (
    <div className="relative h-full flex flex-col">
      <Editor
        ref={textareaRef as any}
        value={value}
        onValueChange={handleInputChange}
        highlight={highlightCode}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        padding={12}
        className={className}
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          fontSize: 14,
          lineHeight: 1.7,
          outline: 'none',
        }}
      />

      {showDropdown && (
        <div
          className="fixed z-[9999] mt-1 w-[450px] max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {filteredItems.map((item, index) => (
            <div
              key={item.fullName}
              onClick={() => selectItem(item)}
              className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                index === selectedIndex
                  ? 'bg-gray-200 dark:bg-gray-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Columns className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.table}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.column}
                  </span>
                </div>
              </div>
              {/* <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {`{{${item.fullName}}}`}
              </div> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
