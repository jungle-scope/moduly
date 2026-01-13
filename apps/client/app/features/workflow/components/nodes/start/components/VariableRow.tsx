import React from 'react';
import { Trash2 } from 'lucide-react';
import { WorkflowVariable, VariableType } from '../../../../types/Nodes';

interface VariableRowProps {
  variable: WorkflowVariable;
  allVariables?: WorkflowVariable[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

export const VariableRow = ({
  variable,
  index,
  onUpdate,
  onDelete,
}: VariableRowProps) => {
  const typeOptions: { value: VariableType; label: string }[] = [
    { value: 'text', label: '텍스트' },
    { value: 'number', label: '숫자' },
    { value: 'paragraph', label: '장문' },
    { value: 'checkbox', label: '체크박스' },
    { value: 'select', label: '선택' },
    { value: 'file', label: '파일' },
  ];

  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
      {/* 아이템 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
          <span className="text-[10px] font-bold tracking-wider text-gray-400">
            입력변수 {index + 1}
          </span>
        </div>
        <button
          onClick={() => onDelete(variable.id)}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 bg-transparent transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          title="입력변수 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* 메인 입력 영역 */}
      <div className="flex flex-col gap-2">
        {/* 첫 번째 줄: Label | 타입 */}
        <div className="flex flex-row items-center gap-2">
          {/* Label 입력 */}
          <div className="flex-1">
            <input
              type="text"
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder="예: 생년월일, 시각, 성별 등"
              value={variable.label || ''}
              onChange={(e) => onUpdate(variable.id, { label: e.target.value })}
            />
          </div>

          {/* 타입 선택 */}
          <div className="flex-1">
            <select
              className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
              value={variable.type}
              onChange={(e) =>
                onUpdate(variable.id, { type: e.target.value as VariableType })
              }
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 두 번째 줄: 옵션 (타입에 따라) */}
        <div className="flex flex-row items-center gap-2">
          {/* 최대 길이 (text, paragraph) */}
          {(variable.type === 'text' || variable.type === 'paragraph') && (
            <>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                최대 길이:
              </span>
              <div className="flex-1">
                <input
                  type="number"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                  placeholder="255"
                  value={variable.maxLength || ''}
                  onChange={(e) =>
                    onUpdate(variable.id, {
                      maxLength: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
            </>
          )}

          {/* 파일 최대 크기 (file) */}
          {variable.type === 'file' && (
            <>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                최대 크기 (MB):
              </span>
              <div className="flex-1">
                <input
                  type="number"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                  placeholder="10"
                  value={
                    variable.maxFileSize
                      ? variable.maxFileSize / (1024 * 1024)
                      : ''
                  }
                  onChange={(e) =>
                    onUpdate(variable.id, {
                      maxFileSize: e.target.value
                        ? parseInt(e.target.value) * 1024 * 1024
                        : undefined,
                    })
                  }
                />
              </div>
            </>
          )}

          {/* 필수 여부 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={variable.required || false}
                onChange={(e) =>
                  onUpdate(variable.id, { required: e.target.checked })
                }
              />
              <span className="text-xs text-gray-600">필수</span>
            </label>
          </div>
        </div>

        {/* Select 타입일 때: 옵션 리스트 */}
        {variable.type === 'select' && (
          <div className="mt-2 flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500">
                선택 옵션
              </span>
              <button
                onClick={() => {
                  const newOption = { label: '', value: '' };
                  onUpdate(variable.id, {
                    options: [...(variable.options || []), newOption],
                  });
                }}
                className="text-[10px] text-blue-600 hover:text-blue-700"
              >
                + 옵션 추가
              </button>
            </div>

            {(variable.options || []).map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-1">
                <input
                  type="text"
                  className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="라벨"
                  value={option.label}
                  onChange={(e) => {
                    const newOptions = [...(variable.options || [])];
                    newOptions[optIndex] = {
                      ...newOptions[optIndex],
                      label: e.target.value,
                    };
                    onUpdate(variable.id, { options: newOptions });
                  }}
                />
                <input
                  type="text"
                  className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                  placeholder="값"
                  value={option.value}
                  onChange={(e) => {
                    const newOptions = [...(variable.options || [])];
                    newOptions[optIndex] = {
                      ...newOptions[optIndex],
                      value: e.target.value,
                    };
                    onUpdate(variable.id, { options: newOptions });
                  }}
                />
                <button
                  onClick={() => {
                    const newOptions = [...(variable.options || [])];
                    newOptions.splice(optIndex, 1);
                    onUpdate(variable.id, { options: newOptions });
                  }}
                  className="text-red-500 hover:text-red-700"
                  title="옵션 삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {(!variable.options || variable.options.length === 0) && (
              <div className="text-center text-[10px] text-gray-400 py-2">
                옵션을 추가해주세요
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
