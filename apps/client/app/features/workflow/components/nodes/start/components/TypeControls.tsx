import React from 'react';
import { WorkflowVariable, VariableType } from '../../../../types/Nodes';

interface TypeControlsProps {
  variable: WorkflowVariable;
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
}

/**
 * 변수 타입 선택 및 필수 여부 체크박스
 */
export const TypeControls = ({ variable, onUpdate }: TypeControlsProps) => {
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as VariableType;
    onUpdate(variable.id, {
      type: newType,
      options: newType === 'select' ? [] : undefined,
      maxLength: undefined,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* 타입 선택 Select */}
      <div className="flex-1">
        <select
          value={variable.type}
          onChange={handleTypeChange}
          className="h-7 w-full rounded border border-border bg-background px-1 text-xs focus:border-primary focus:outline-none"
        >
          <option value="text">Short Text</option>
          <option value="paragraph">Paragraph</option>
          <option value="number">Number</option>
          <option value="checkbox">Checkbox</option>
          <option value="select">Select</option>
          <option value="file">File Upload</option>
        </select>
      </div>

      {/* 필수 체크박스 */}
      <div className="flex items-center gap-1 pt-1">
        <input
          type="checkbox"
          checked={variable.required}
          onChange={(e) =>
            onUpdate(variable.id, { required: e.target.checked })
          }
          id={`req-${variable.id}`}
          className="h-3 w-3 rounded border-gray-300"
        />
        <label
          htmlFor={`req-${variable.id}`}
          className="cursor-pointer select-none text-xs text-muted-foreground"
        >
          필수
        </label>
      </div>
    </div>
  );
};
