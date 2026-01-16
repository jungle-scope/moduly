import { memo } from 'react';
import { Position, Node, NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { BaseNode, SmartHandle } from '../../BaseNode';
import { ConditionNodeData } from '../../../../types/Nodes';

export const ConditionNode = memo(
  ({
    data,
    selected,
    id,
  }: NodeProps<Node<ConditionNodeData>> & { highlightedHandle?: string }) => {
    const cases = data.cases || [];

    // Get highlightedHandle from global context (will be set by drag preview)
    const highlightedHandle = (window as any).__dragHighlightedHandle__ || null;

    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        showSourceHandle={false}
        icon={<GitFork className="text-white" />}
        iconColor="#f97316" // orange-500
      >
        <div className="p-4 text-sm text-gray-500 text-center">
          {/* Output Handles - Flexbox Refactor */}
          {/* 탭 높이(14px)만큼 더 바깥으로 내밀기 위해 너비와 마진 조정 (28px + 14px = 42px) */}
          {/* Output Handles - Refactored for correct alignment */}
          <div className="flex flex-col gap-2 mt-4 z-10 w-full">
            {/* Case별 핸들 */}
            {cases.map((caseItem, index) => {
              const isHighlighted = highlightedHandle === caseItem.id;
              return (
                <div
                  key={caseItem.id}
                  className={`
                    flex items-center justify-end h-6 relative z-50
                    transition-all duration-200 rounded px-2 -mx-2
                    ${
                      isHighlighted
                        ? 'bg-blue-100 border-2 border-blue-500 scale-105 shadow-lg'
                        : 'bg-transparent border-2 border-transparent'
                    }
                  `}
                >
                  <span className="mr-3 text-base text-blue-600 font-semibold whitespace-nowrap">
                    {caseItem.case_name || `Case ${index + 1}`}
                  </span>
                  <SmartHandle
                    type="source"
                    position={Position.Right}
                    id={caseItem.id}
                    className="!absolute !right-[-36px]"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              );
            })}

            {/* Else 핸들 - 항상 마지막 */}
            <div
              className={`
                flex items-center justify-end h-6 relative z-50
                transition-all duration-200 rounded px-2 -mx-2
                ${
                  highlightedHandle === 'default'
                    ? 'bg-blue-100 border-2 border-blue-500 scale-105 shadow-lg'
                    : 'bg-transparent border-2 border-transparent'
                }
              `}
            >
              <span className="mr-3 text-base text-gray-500 font-semibold whitespace-nowrap">
                Default
              </span>
              <SmartHandle
                type="source"
                position={Position.Right}
                id="default"
                className="!absolute !right-[-36px]"
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
