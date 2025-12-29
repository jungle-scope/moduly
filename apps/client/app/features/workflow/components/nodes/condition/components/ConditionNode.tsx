import { memo } from 'react';
import { Handle, Position, Node, NodeProps } from '@xyflow/react';
import { BaseNode } from '../../BaseNode';
import { ConditionNodeData } from '../../../../types/Nodes';

export const ConditionNode = memo(
  ({ data, selected }: NodeProps<Node<ConditionNodeData>>) => {
    const cases = data.cases || [];

    return (
      <BaseNode data={data} selected={selected} showSourceHandle={false}>
        <div className="p-4 text-sm text-gray-500 text-center">
          {/* Condition Logic Visualization */}
          <div className="mb-2">
            {cases.length > 0
              ? `${cases.length}개 분기 조건`
              : '조건에 따라 분기합니다'}
          </div>

          {/* Output Handles - Flexbox Refactor */}
          <div className="flex flex-col gap-2 mt-4 z-10 w-[calc(100%+28px)] -mr-7 self-end">
            {/* Case별 핸들 */}
            {cases.map((caseItem, index) => (
              <div
                key={caseItem.id}
                className="flex items-center justify-end h-6 relative z-50"
              >
                <span className="mr-2 text-xs text-blue-600 font-semibold whitespace-nowrap">
                  {caseItem.case_name || `Case ${index + 1}`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={caseItem.id}
                  className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !static !transform-none"
                />
              </div>
            ))}

            {/* Else 핸들 - 항상 마지막 */}
            <div className="flex items-center justify-end h-6 relative z-50">
              <span className="mr-2 text-xs text-gray-500 font-semibold whitespace-nowrap">
                Default
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !static !transform-none"
              />
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

ConditionNode.displayName = 'ConditionNode';
