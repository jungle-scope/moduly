import React from 'react';
import { SelectOption } from '../../../../types/Nodes';
import { IconPlus, IconX } from '../icons';

interface SelectSettingProps {
  options?: SelectOption[];
  // 옵션 리스트가 통째로 바뀔 때 부모에게 알려줍니다.
  onChange: (options: SelectOption[]) => void;
  // 유효성 검사 에러 메시지
  error?: string | null;
}

// 드롭다운(Select)의 옵션 목록을 관리(추가/수정/삭제)
export const SelectSetting = ({
  options = [],
  onChange,
  error,
}: SelectSettingProps) => {
  // 1. 옵션 추가
  const addOption = () => {
    const newOptions = [
      ...options,
      { label: `옵션 ${options.length + 1}`, value: '' },
    ];
    onChange(newOptions);
  };

  // 2. 옵션 수정 (라벨/값)
  const updateOption = (
    index: number,
    field: keyof SelectOption,
    value: string,
  ) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    onChange(newOptions);
  };

  // 3. 옵션 삭제
  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* 헤더: 제목 + 추가 버튼 */}
      <div className="flex items-center justify-between">
        <span>옵션 목록</span>
        <button
          onClick={addOption}
          className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
        >
          <IconPlus className="h-3 w-3" /> 추가
        </button>
      </div>

      {/* 옵션 리스트 */}
      <div className="flex flex-col gap-1">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-1 items-center">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOption(i, 'label', e.target.value)}
              placeholder="라벨"
              className="h-6 flex-1 min-w-0 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
            />
            <input
              type="text"
              value={opt.value}
              onChange={(e) => updateOption(i, 'value', e.target.value)}
              placeholder="값"
              className="h-6 flex-1 min-w-0 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => removeOption(i)}
              className="flex-shrink-0 text-muted-foreground hover:text-red-500"
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* 안내 메시지 / 에러 메시지 */}
        {options.length === 0 && (
          <p className="text-[10px] italic text-red-500 opacity-80">
            {error || '추가된 옵션이 없습니다'}
          </p>
        )}

        {options.length > 0 && error && (
          <p className="text-[10px] text-red-500 mt-1">🚨 {error}</p>
        )}
      </div>
    </div>
  );
};
