import React from 'react';
import { WorkflowVariable } from '../../../../types/Nodes';

interface BasicInfoInputsProps {
  variable: WorkflowVariable;
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
  error?: string | null;
}

/**
 * 변수명(Key)과 표시명(Label) 입력 필드
 */
export const BasicInfoInputs = ({
  variable,
  onUpdate,
  error,
}: BasicInfoInputsProps) => {
  return (
    <div className="flex gap-2">
      {/* 변수명 (Key) */}
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">
          변수명 (Key)
        </label>
        <input
          type="text"
          value={variable.name}
          onChange={(e) => onUpdate(variable.id, { name: e.target.value })}
          placeholder="key_name"
          className={`h-7 w-full rounded border px-2 text-xs focus:outline-none ${
            error
              ? 'border-red-500 focus:border-red-500' // 에러 시 빨간색
              : 'border-border bg-background focus:border-primary' // 평소
          }`}
        />
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>

      {/* 표시명 (Label) */}
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">
          표시명 (Label)
        </label>
        <input
          type="text"
          value={variable.label}
          onChange={(e) => onUpdate(variable.id, { label: e.target.value })}
          placeholder="필드 이름"
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
};
