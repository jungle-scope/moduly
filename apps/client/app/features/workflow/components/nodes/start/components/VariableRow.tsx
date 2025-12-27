import React from 'react';
import { WorkflowVariable } from '../../../../types/Nodes';
import { VariableSettings } from './VariableSettings';
import { VariableHeader } from './VariableHeader';

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
  allVariables,
  index,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: VariableRowProps) => {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-card p-3 shadow-sm">
      {/* 상단 행: 이름, 타입, 액션 */}
      <VariableHeader
        variable={variable}
        allVariables={allVariables}
        index={index}
        isFirst={isFirst}
        isLast={isLast}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onMove={onMove}
      />

      {/* 하단 옵션 영역 */}
      <VariableSettings
        variable={variable}
        allVariables={allVariables}
        onUpdate={onUpdate}
      />
    </div>
  );
};
