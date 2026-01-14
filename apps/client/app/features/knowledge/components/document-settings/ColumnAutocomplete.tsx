'use client';

import React, { useState, useRef } from 'react';

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

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
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

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

    setDropdownPosition({
      top:
        rect.top +
        window.scrollY +
        spanOffsetTop +
        lineHeight -
        textarea.scrollTop,
      left: rect.left + window.scrollX + spanOffsetLeft - textarea.scrollLeft,
    });

    document.body.removeChild(div);
  };

  // {{ 감지 및 자동완성
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
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
      setSelectedIndex(0);
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
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
    const beforeBrace = value.substring(0, lastOpenBrace);

    const newValue = `${beforeBrace}{{${item.fullName}}}${textAfterCursor}`;
    onChange(newValue);

    // Alias 자동 생성
    if (onAliasGenerate) {
      onAliasGenerate(item.table, item.column, item.fullName);
    }

    // 커서 위치 조정
    const newCursorPos = beforeBrace.length + item.fullName.length + 4;
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);

    setShowDropdown(false);
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredItems.length - 1 : prev - 1,
      );
    } else if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      selectItem(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {showDropdown && (
        <div
          className="fixed z-[9999] mt-1 max-w-md max-h-48 overflow-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {filteredItems.map((item, index) => (
            <div
              key={item.fullName}
              onClick={() => selectItem(item)}
              className={`px-3 py-2.5 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-medium">
                  {item.table}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.column}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {`{{${item.fullName}}}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
