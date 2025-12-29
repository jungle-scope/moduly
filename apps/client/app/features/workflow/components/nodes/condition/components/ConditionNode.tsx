import { memo } from 'react';
import { Handle, Position, Node, NodeProps } from '@xyflow/react';
import { BaseNode } from '../../BaseNode';
import { ConditionNodeData } from '../../../../types/Nodes';

export const ConditionNode = memo(
  ({ data, selected }: NodeProps<Node<ConditionNodeData>>) => {
    return (
      <BaseNode data={data} selected={selected} showSourceHandle={false}>
        <div className="p-4 text-sm text-gray-500 text-center">
          {/* Input Handle */}
          <Handle
            type="target"
            position={Position.Left}
            className="!bg-blue-500 !w-3 !h-3"
          />

          {/* Condition Logic Visualization could go here */}
          <div className="mb-2">조건에 따라 분기합니다</div>

          {/* Output Handles */}
          <div className="relative h-16 w-full flex flex-col justify-between mt-4">
            <div className="absolute right-[-28px] top-0 flex items-center">
              <span className="mr-2 text-xs text-blue-600 font-semibold">
                True
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                className="!bg-blue-500 !w-3 !h-3 !right-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            <div className="absolute right-[-28px] bottom-0 flex items-center">
              <span className="mr-2 text-xs text-red-600 font-semibold">
                False
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                className="!bg-red-500 !w-3 !h-3 !right-0"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

ConditionNode.displayName = 'ConditionNode';
