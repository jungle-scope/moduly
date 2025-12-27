import React from 'react';
import { WorkflowVariable } from '../../../../types/Nodes';
import { VariableRow } from './VariableRow';
import { IconPlus } from '../icons';

interface VariableListProps {
  variables: WorkflowVariable[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

export const VariableList = ({
  variables,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: VariableListProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">입력 변수</span>
      </div>
      <div className="flex flex-col gap-2">
        {variables.map((variable, index) => (
          <VariableRow
            key={variable.id}
            variable={variable}
            allVariables={variables}
            index={index}
            isFirst={index === 0}
            isLast={index === variables.length - 1}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
        {variables.length === 0 && (
          <div className="rounded border border-dashed border-border bg-muted/30 py-2 text-center text-xs text-muted-foreground">
            변수가 없습니다.
          </div>
        )}
      </div>
      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        <IconPlus className="h-3 w-3" /> 변수 추가
      </button>
    </div>
  );
};
