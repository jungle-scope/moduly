import React from 'react';
import { WorkflowVariable } from '../../../../types/Nodes';
import { VariableRow } from './VariableRow';

interface VariableListProps {
  variables: WorkflowVariable[];
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

export const VariableList = ({
  variables,
  onUpdate,
  onDelete,
  onMove,
}: VariableListProps) => {
  return (
    <div className="flex flex-col gap-3">
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
    </div>
  );
};
