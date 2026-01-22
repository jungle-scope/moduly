import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';

interface JsonTreeViewerProps {
  data: any;
  path?: string;
  onSelect?: (path: string, value: any) => void;
  level?: number;
}

export function JsonTreeViewer({
  data,
  path = '',
  onSelect,
  level = 0,
}: JsonTreeViewerProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // 초기 2단계까지만 펼침
  const isObject =
    data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(path, data);
    }
  };

  // Primitive value rendering
  if (!isObject && !isArray) {
    let valueColor = 'text-green-600'; // string
    if (typeof data === 'number') valueColor = 'text-blue-600';
    if (typeof data === 'boolean') valueColor = 'text-purple-600';
    if (data === null) valueColor = 'text-gray-500';

    return (
      <div className="group flex items-center gap-2 py-0.5 hover:bg-gray-100 rounded px-1 transition-colors font-mono text-sm leading-6">
        <span className={valueColor}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
        {onSelect && path && (
          <button
            onClick={handleSelect}
            className="opacity-0 group-hover:opacity-100 p-0.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded transition-all transform scale-90 active:scale-95"
            title="이 값을 변수로 추가"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Object or Array rendering
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  return (
    <div className="font-mono text-sm leading-6">
      <div
        className="flex items-center gap-1 hover:bg-gray-50 rounded px-1 cursor-pointer select-none"
        onClick={handleToggle}
      >
        {!isEmpty ? (
          <span className="text-gray-400">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        ) : (
          <span className="w-4" /> // spacing placeholder
        )}

        <span className="text-gray-600">{isArray ? '[' : '{'}</span>
        {!isExpanded && !isEmpty && (
          <span className="text-gray-400 text-xs ml-1">...</span>
        )}
        {(!isExpanded || isEmpty) && (
          <span className="text-gray-600">{isArray ? ']' : '}'}</span>
        )}

        {/* 배열이나 객체 그 자체를 선택하고 싶을 때를 위해 */}
        {onSelect && path && (
          <button
            onClick={handleSelect}
            className="ml-2 opacity-0 hover:opacity-100 p-0.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded transition-all transform scale-90 active:scale-95"
            title="이 객체/배열 전체를 매핑"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {isExpanded && !isEmpty && (
        <div className="ml-4 border-l border-gray-200 pl-2">
          {keys.map((key, index) => {
            const currentPath = path
              ? isArray
                ? `${path}[${key}]`
                : `${path}.${key}`
              : key;
            return (
              <div key={key} className="flex items-start">
                <span className="text-gray-800 mr-1 py-0.5">
                  {/* 배열 인덱스는 그대로, 객체 키는 따옴표 없이 표시하거나 취향껏 */}
                  {isArray ? '' : `${key}:`}
                </span>
                <JsonTreeViewer
                  data={data[key]}
                  path={currentPath}
                  onSelect={onSelect}
                  level={level + 1}
                />
                {index < keys.length - 1 && (
                  <span className="text-gray-400">,</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isExpanded && !isEmpty && (
        <div className="hover:bg-gray-50 rounded px-1">
          <span className="text-gray-600">{isArray ? ']' : '}'}</span>
        </div>
      )}
    </div>
  );
}
