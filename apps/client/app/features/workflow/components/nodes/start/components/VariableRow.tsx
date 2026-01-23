import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  ChevronDown,
  Type,
  AlignLeft,
  Hash,
  CheckSquare,
  List,
  FileText,
} from 'lucide-react';
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

// 타입 옵션 정의 (아이콘 포함)
const TYPE_OPTIONS: Array<{
  value: VariableType;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { value: 'text', label: '텍스트', icon: Type },
  { value: 'number', label: '숫자', icon: Hash },
  { value: 'paragraph', label: '장문', icon: AlignLeft },
  { value: 'checkbox', label: '체크박스', icon: CheckSquare },
  { value: 'select', label: '선택', icon: List },
  { value: 'file', label: '파일 업로드', icon: FileText },
];

export const VariableRow = ({
  variable,
  index,
  onUpdate,
  onDelete,
}: VariableRowProps) => {
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTypeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 현재 선택된 타입 정보
  const selectedOption = TYPE_OPTIONS.find(
    (opt) => opt.value === variable.type,
  );
  const SelectedIcon = selectedOption?.icon || Type;

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
        <div className="flex items-center gap-1.5">
          {/* 필수 체크박스 - 주변과 어우러지는 subtle한 스타일 */}
          <label className="flex items-center gap-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
            <input
              type="checkbox"
              className="h-2.5 w-2.5 rounded border-gray-300 text-gray-500 focus:ring-0 focus:ring-offset-0"
              checked={variable.required || false}
              onChange={(e) =>
                onUpdate(variable.id, { required: e.target.checked })
              }
            />
            <span className="text-[10px] text-gray-400 font-medium tracking-wider">
              필수
            </span>
          </label>
          {/* 삭제 버튼 */}
          <button
            onClick={() => onDelete(variable.id)}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 bg-transparent transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            title="입력변수 삭제"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 메인 입력 영역 */}
      <div className="flex flex-col gap-2">
        {/* 첫 번째 줄: 변수명 | 타입 */}
        <div className="flex flex-row items-center gap-2">
          {/* 변수명 입력 */}
          <div className="flex-1">
            <input
              type="text"
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-blue-600 placeholder:font-normal placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder="변수명 (예: user_name)"
              value={variable.name}
              onChange={(e) => onUpdate(variable.id, { name: e.target.value })}
            />
          </div>

          {/* 타입 선택 - 커스텀 드롭다운 */}
          <div className="flex-1 relative" ref={typeDropdownRef}>
            {/* 트리거 버튼 */}
            <button
              type="button"
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              className={`w-full flex items-center justify-between gap-1.5 rounded-md border bg-gray-50 px-2 py-1.5 text-xs font-medium transition-all
                hover:border-gray-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500
                ${isTypeOpen ? 'border-blue-500 bg-white ring-1 ring-blue-500' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <SelectedIcon className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                <span className="truncate text-gray-700">
                  {selectedOption?.label || '타입 선택'}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${
                  isTypeOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 드롭다운 팝오버 */}
            {isTypeOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                <div className="py-1">
                  {TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = option.value === variable.type;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onUpdate(variable.id, {
                            type: option.value,
                            options: option.value === 'select' ? [] : undefined,
                            maxLength: undefined,
                          });
                          setIsTypeOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        />
                        <span className="truncate">{option.label}</span>
                        {isSelected && (
                          <span className="ml-auto text-blue-600 text-[10px]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
