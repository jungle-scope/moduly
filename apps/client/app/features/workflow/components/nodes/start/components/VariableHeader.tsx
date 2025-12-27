import React from 'react';
import { WorkflowVariable } from '@/app/features/workflow/types/Nodes';
import { IconTrash } from '../icons';
import { validateVariableName } from '../hooks/useVariableManager';
import { OrderControls } from './OrderControls';
import { BasicInfoInputs } from './BasicInfoInputs';
import { TypeControls } from './TypeControls';

interface VariableHeaderProps {
  variable: WorkflowVariable;
  allVariables?: WorkflowVariable[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

export const VariableHeader = ({
  variable,
  allVariables = [],
  index,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: VariableHeaderProps) => {
  const otherNames = allVariables
    .filter((v) => v.id !== variable.id)
    .map((v) => v.name);

  const error = validateVariableName(variable.name, variable.label, otherNames);

  return (
    <div className="flex items-start gap-2">
      {/* 1. 순서 제어 (OrderControls) */}
      <OrderControls
        index={index}
        isFirst={isFirst}
        isLast={isLast}
        onMove={onMove}
      />

      <div className="flex flex-1 flex-col gap-2">
        {/* 2. 기본 정보 입력 (BasicInfoInputs) */}
        <BasicInfoInputs
          variable={variable}
          onUpdate={onUpdate}
          error={error}
        />

        {/* 3. 타입 설정 (TypeControls) */}
        <TypeControls variable={variable} onUpdate={onUpdate} />
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onDelete(variable.id)}
        className="mt-1 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-600"
      >
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );
};
