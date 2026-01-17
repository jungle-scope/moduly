'use client';

import { getDisplayConfig, excludeFields, isEmpty } from './nodeDisplayConfig';
import { OptionFieldItem } from './OptionFieldItem';

interface NodeOptionsDisplayProps {
  nodeType: string;
  options: Record<string, any>;
}

/**
 * 노드 타입별 설정을 표시하는 컴포넌트
 */
export const NodeOptionsDisplay = ({
  nodeType,
  options,
}: NodeOptionsDisplayProps) => {
  const config = getDisplayConfig(nodeType);

  // 설정이 없으면 필터링된 JSON 표시 (기존 유지)
  if (!config) {
    const filteredOptions = Object.fromEntries(
      Object.entries(options).filter(([key]) => !excludeFields.includes(key))
    );
    if (Object.keys(filteredOptions).length === 0) return null;

    // CollapsibleSection에서 사용되므로 외부 래퍼 없이 내용만 반환
    return (
      <pre className="text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
        {JSON.stringify(filteredOptions, null, 2)}
      </pre>
    );
  }

  // 렌더링할 행 데이터 준비
  const displayRows = config.rows.map((row) =>
    row.map((field) => ({
      ...field,
      value: options[field.key],
      isEmpty: isEmpty(options[field.key]),
    }))
  );

  // 모든 필드가 undefined면 표시 안 함
  const hasAnyValue = displayRows.flat().some((item) => item.value !== undefined);
  if (!hasAnyValue) return null;

  // CollapsibleSection에서 사용되므로 외부 래퍼 없이 내용만 반환
  return (
    <div className="space-y-3">
      {displayRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {row.map((item) => (
            <div key={item.key} className="flex-1 min-w-0">
              <OptionFieldItem
                label={item.label}
                value={item.value}
                type={item.type}
                isEmpty={item.isEmpty}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
