import { useCallback, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
// import { v4 as uuidv4 } from 'uuid';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  ConditionNodeData,
  Condition,
  StartNodeData,
} from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';

interface ConditionNodePanelProps {
  nodeId: string;
  data: ConditionNodeData;
}

const CONDITION_OPERATORS = [
  { label: 'Equals', value: 'equals' },
  { label: 'Not Equals', value: 'not_equals' },
  { label: 'Contains', value: 'contains' },
  { label: 'Not Contains', value: 'not_contains' },
  { label: 'Starts With', value: 'starts_with' },
  { label: 'Ends With', value: 'ends_with' },
  { label: 'Is Empty', value: 'is_empty' },
  { label: 'Is Not Empty', value: 'is_not_empty' },
  { label: 'Greater Than', value: 'greater_than' },
  { label: 'Less Than', value: 'less_than' },
  { label: 'Greater Than Or Equal', value: 'greater_than_or_equals' },
  { label: 'Less Than Or Equal', value: 'less_than_or_equals' },
];

export function ConditionNodePanel({ nodeId, data }: ConditionNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleAddCondition = useCallback(() => {
    const newCondition: Condition = {
      id: crypto.randomUUID(),
      variable_selector: [],
      operator: 'equals',
      value: '',
    };

    const newConditions = [...(data.conditions || []), newCondition];
    updateNodeData(nodeId, { conditions: newConditions });
  }, [data.conditions, nodeId, updateNodeData]);

  const handleUpdateCondition = useCallback(
    (index: number, field: keyof Condition, value: any) => {
      const newConditions = [...(data.conditions || [])];
      newConditions[index] = { ...newConditions[index], [field]: value };
      updateNodeData(nodeId, { conditions: newConditions });
    },
    [data.conditions, nodeId, updateNodeData],
  );

  const handleRemoveCondition = useCallback(
    (index: number) => {
      const newConditions = [...(data.conditions || [])];
      newConditions.splice(index, 1);
      updateNodeData(nodeId, { conditions: newConditions });
    },
    [data.conditions, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">
            Conditions
          </span>
          <button
            onClick={handleAddCondition}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-500 mb-2">
            조건을 설정하여 워크플로우를 분기할 수 있습니다.
            <br />
            (모든 조건은 현재 AND 로직으로 동작합니다)
          </div>

          {data.conditions?.map((condition, index) => {
            const selectedSourceNodeId = condition.variable_selector?.[0];
            const selectedSourceNode = nodes.find(
              (n) => n.id === selectedSourceNodeId,
            );

            // 소스 노드에서 변수 가져오기
            let sourceVariables: { label: string; value: string }[] = [];
            const isStartNode = selectedSourceNode?.type === 'startNode';

            if (isStartNode) {
              const startData =
                selectedSourceNode.data as unknown as StartNodeData;
              sourceVariables = (startData.variables || []).map((v) => ({
                label: v.name,
                value: v.name,
              }));
            }

            return (
              <div
                key={condition.id}
                className="flex flex-col gap-3 rounded border border-gray-200 p-3 bg-gray-50 relative"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    Condition #{index + 1}
                  </span>
                  <button
                    className="flex items-center justify-center h-6 w-6 text-red-500 hover:bg-red-50 rounded"
                    onClick={() => handleRemoveCondition(index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Variable Selector Row */}
                <div className="flex gap-2">
                  <select
                    className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    value={condition.variable_selector?.[0] || ''}
                    onChange={(e) => {
                      // Reset second part of selector when node changes
                      handleUpdateCondition(index, 'variable_selector', [
                        e.target.value,
                        '',
                      ]);
                    }}
                  >
                    <option value="" disabled>
                      노드 선택
                    </option>
                    {upstreamNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {(n.data as { title?: string })?.title || n.type}
                      </option>
                    ))}
                  </select>

                  {isStartNode ? (
                    <select
                      className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                      value={condition.variable_selector?.[1] || ''}
                      onChange={(e) => {
                        const currentNode =
                          condition.variable_selector?.[0] || '';
                        handleUpdateCondition(index, 'variable_selector', [
                          currentNode,
                          e.target.value,
                        ]);
                      }}
                      disabled={sourceVariables.length === 0}
                    >
                      <option value="" disabled>
                        {sourceVariables.length === 0
                          ? '변수 없음'
                          : '변수 선택'}
                      </option>
                      {sourceVariables.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="변수 키"
                      value={condition.variable_selector?.[1] || ''}
                      onChange={(e) => {
                        const currentNode =
                          condition.variable_selector?.[0] || '';
                        handleUpdateCondition(index, 'variable_selector', [
                          currentNode,
                          e.target.value,
                        ]);
                      }}
                    />
                  )}
                </div>

                {/* Operator Selector */}
                <select
                  className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  value={condition.operator}
                  onChange={(e) =>
                    handleUpdateCondition(index, 'operator', e.target.value)
                  }
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                <input
                  className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="비교할 값"
                  value={condition.value}
                  onChange={(e) =>
                    handleUpdateCondition(index, 'value', e.target.value)
                  }
                />
              </div>
            );
          })}

          {(!data.conditions || data.conditions.length === 0) && (
            <div className="text-center py-8 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-400 text-xs">
              조건이 없습니다. <br />+ 버튼을 눌러 추가하세요.
            </div>
          )}

          <button
            onClick={handleAddCondition}
            className="w-full py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
          >
            + 조건 추가
          </button>
        </div>
      </div>
    </div>
  );
}
