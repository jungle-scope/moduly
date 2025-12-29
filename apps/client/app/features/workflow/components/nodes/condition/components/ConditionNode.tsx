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

          {/* Output Handles - 동적 생성 */}
          <div
            className="relative w-full flex flex-col justify-between mt-4 z-10"
            style={{ minHeight: `${Math.max((cases.length + 1) * 32, 64)}px` }}
          >
            {/* Case별 핸들 */}
            {cases.map((caseItem, index) => (
              <div
                key={caseItem.id}
                className="absolute right-[-28px] flex items-center z-50"
                style={{ top: `${index * 32}px` }}
              >
                <span className="mr-2 text-xs text-blue-600 font-semibold whitespace-nowrap">
                  {caseItem.case_name || `Case ${index + 1}`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={caseItem.id}
                  className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !right-0"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
            ))}

            {/* Else 핸들 - 항상 마지막 */}
            <div
              className="absolute right-[-28px] flex items-center z-50"
              style={{ top: `${cases.length * 32}px` }}
            >
              <span className="mr-2 text-xs text-gray-500 font-semibold whitespace-nowrap">
                Default
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !right-0"
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
