import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { StartNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { useVariableManager } from '../hooks/useVariableManager';
import { VariableList } from './VariableList';
import { TriggerSection } from './TriggerSection';

export const StartNode = memo(
  ({ id, data, selected }: NodeProps<Node<StartNodeData>>) => {
    const {
      variables,
      addVariable,
      updateVariable,
      deleteVariable,
      moveVariable,
    } = useVariableManager(id, data);

    return (
      <BaseNode
        data={data}
        selected={selected}
        showTargetHandle={false}
        showSourceHandle={true}
        className="border-green-500/50 min-w-[280px]"
      >
        <div className="flex flex-col gap-4">
          {/* 1. 트리거 정보 표시 */}
          <TriggerSection type={data.triggerType} />

          {/* 구분선 */}
          <div className="h-px bg-border" />

          {/* 2. 변수 목록 */}
          <VariableList
            variables={variables}
            onAdd={addVariable}
            onUpdate={updateVariable}
            onDelete={deleteVariable}
            onMove={moveVariable}
          />
        </div>
      </BaseNode>
    );
  },
);
StartNode.displayName = 'StartNode';
