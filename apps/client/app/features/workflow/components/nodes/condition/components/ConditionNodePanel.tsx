import { useCallback, useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  ConditionNodeData,
  Condition,
  ConditionCase,
  StartNodeData,
} from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';

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

  const cases = data.cases || [];

  // Case 추가
  const handleAddCase = useCallback(() => {
    let caseIndex = 1;
    while (cases.some((c) => c.case_name === `Case ${caseIndex}`)) {
      caseIndex++;
    }

    const newCase: ConditionCase = {
      id: crypto.randomUUID(),
      case_name: `Case ${caseIndex}`,
      conditions: [],
      logical_operator: 'and',
    };

    updateNodeData(nodeId, { cases: [...cases, newCase] });
  }, [cases, nodeId, updateNodeData]);

  // Case 삭제
  const handleRemoveCase = useCallback(
    (caseIndex: number) => {
      const caseToRemove = cases[caseIndex];
      const remainingCases = cases.filter((_, i) => i !== caseIndex);

      // 1. Edge 제거 (삭제된 Case에 연결된 엣지 제거)
      if (caseToRemove) {
        useWorkflowStore.setState((state) => ({
          edges: state.edges.filter(
            (edge) =>
              !(
                edge.source === nodeId && edge.sourceHandle === caseToRemove.id
              ),
          ),
        }));
      }

      // Re-numbering: 'Case N' 패턴을 가진 케이스들을 인덱스에 맞춰 'Case i+1'로 변경
      const newCases = remainingCases.map((c, i) => {
        if (/^Case\s+\d+$/.test(c.case_name)) {
          return { ...c, case_name: `Case ${i + 1}` };
        }
        return c;
      });

      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  // Case 이름 수정
  const handleUpdateCaseName = useCallback(
    (caseIndex: number, newName: string) => {
      const newCases = [...cases];
      newCases[caseIndex] = { ...newCases[caseIndex], case_name: newName };
      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  // Case 논리 연산자 수정
  const handleUpdateCaseLogicalOperator = useCallback(
    (caseIndex: number, operator: 'and' | 'or') => {
      const newCases = [...cases];
      newCases[caseIndex] = {
        ...newCases[caseIndex],
        logical_operator: operator,
      };
      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  // 조건 추가
  const handleAddCondition = useCallback(
    (caseIndex: number) => {
      const newCondition: Condition = {
        id: crypto.randomUUID(),
        variable_selector: [],
        operator: 'equals',
        value: '',
      };

      const newCases = [...cases];
      newCases[caseIndex] = {
        ...newCases[caseIndex],
        conditions: [...newCases[caseIndex].conditions, newCondition],
      };
      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  // 조건 수정
  const handleUpdateCondition = useCallback(
    (
      caseIndex: number,
      conditionIndex: number,
      field: keyof Condition,
      value: any,
    ) => {
      const newCases = [...cases];
      const newConditions = [...newCases[caseIndex].conditions];
      newConditions[conditionIndex] = {
        ...newConditions[conditionIndex],
        [field]: value,
      };
      newCases[caseIndex] = {
        ...newCases[caseIndex],
        conditions: newConditions,
      };
      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  // 조건 삭제
  const handleRemoveCondition = useCallback(
    (caseIndex: number, conditionIndex: number) => {
      const newCases = [...cases];
      const newConditions = newCases[caseIndex].conditions.filter(
        (_, i) => i !== conditionIndex,
      );
      newCases[caseIndex] = {
        ...newCases[caseIndex],
        conditions: newConditions,
      };
      updateNodeData(nodeId, { cases: newCases });
    },
    [cases, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col gap-2">
      <CollapsibleSection
        title={`분기 조건 (${cases.length}개)`}
        showDivider
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddCase();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors ml-auto"
            title="분기 추가"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          {cases.map((caseItem, caseIndex) => {
            return (
              <div
                key={caseItem.id}
                className="border border-gray-200 rounded-lg overflow-hidden border-l-4 border-l-blue-500"
              >
                {/* Case 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <input
                      className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 transition-colors hover:bg-gray-200/50"
                      value={caseItem.case_name}
                      onChange={(e) =>
                        handleUpdateCaseName(caseIndex, e.target.value)
                      }
                      placeholder={`Case ${caseIndex + 1}`}
                    />
                    <div className="relative">
                      <select
                        className="appearance-none text-xs pl-2 pr-6 py-1 rounded border border-gray-200 bg-white font-medium text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all cursor-pointer"
                        value={caseItem.logical_operator}
                        onChange={(e) =>
                          handleUpdateCaseLogicalOperator(
                            caseIndex,
                            e.target.value as 'and' | 'or',
                          )
                        }
                      >
                        <option value="and">AND</option>
                        <option value="or">OR</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                        <svg
                          className="h-3 w-3 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAddCondition(caseIndex)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="조건 추가"
                    >
                      <Plus className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleRemoveCase(caseIndex)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="분기 삭제"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* 조건 목록 */}
                <div className="p-3 space-y-3">
                  {caseItem.conditions.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-xs">
                      조건이 없습니다 (항상 참)
                    </div>
                  ) : (
                    caseItem.conditions.map((condition, conditionIndex) => {
                      const selectedSourceNodeId =
                        condition.variable_selector?.[0];
                      const selectedSourceNode = nodes.find(
                        (n) => n.id === selectedSourceNodeId,
                      );

                      let sourceVariables: { label: string; value: string }[] =
                        [];
                      const isStartNode =
                        selectedSourceNode &&
                        (selectedSourceNode.type as string) === 'startNode';

                      if (isStartNode && selectedSourceNode) {
                        const startData =
                          selectedSourceNode.data as unknown as StartNodeData;
                        /**
                         * [중요] 변수 ID를 value로 저장하는 이유:
                         * - 사용자가 변수 이름을 변경해도 참조가 깨지지 않도록 함
                         * - 예: 변수명 "name" → "username" 변경 시
                         *   - 이름 기반: "name"을 찾음 → 없음 ❌
                         *   - ID 기반: "45af2b51-..."를 찾음 → 정상 동작 ✅
                         * - ID는 변경되지 않으므로 참조 안정성 보장
                         */
                        sourceVariables = (startData.variables || []).map(
                          (v) => ({
                            label: v.name, // 드롭다운에는 이름 표시 (사용자 가독성)
                            value: v.id, // 저장할 때는 ID 사용 (참조 안정성)
                          }),
                        );
                      }

                      return (
                        <div
                          key={condition.id}
                          className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:border-blue-300/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              조건 #{conditionIndex + 1}
                            </span>
                            <button
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              onClick={() =>
                                handleRemoveCondition(caseIndex, conditionIndex)
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Variable Selector Row */}
                          <div className="flex gap-2">
                            <select
                              className="w-1/2 appearance-none rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                              value={condition.variable_selector?.[0] || ''}
                              onChange={(e) => {
                                handleUpdateCondition(
                                  caseIndex,
                                  conditionIndex,
                                  'variable_selector',
                                  [e.target.value, ''],
                                );
                              }}
                            >
                              <option value="" disabled>
                                노드 선택
                              </option>
                              {upstreamNodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {(n.data as { title?: string })?.title ||
                                    n.type}
                                </option>
                              ))}
                            </select>

                            {isStartNode ? (
                              <select
                                className="w-1/2 appearance-none rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                                value={condition.variable_selector?.[1] || ''}
                                onChange={(e) => {
                                  const currentNode =
                                    condition.variable_selector?.[0] || '';
                                  handleUpdateCondition(
                                    caseIndex,
                                    conditionIndex,
                                    'variable_selector',
                                    [currentNode, e.target.value],
                                  );
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
                                className="w-1/2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 placeholder:font-normal placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                                placeholder="변수 키"
                                value={condition.variable_selector?.[1] || ''}
                                onChange={(e) => {
                                  const currentNode =
                                    condition.variable_selector?.[0] || '';
                                  handleUpdateCondition(
                                    caseIndex,
                                    conditionIndex,
                                    'variable_selector',
                                    [currentNode, e.target.value],
                                  );
                                }}
                              />
                            )}
                          </div>

                          {/* Operator Selector */}
                          <select
                            className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                            value={condition.operator}
                            onChange={(e) =>
                              handleUpdateCondition(
                                caseIndex,
                                conditionIndex,
                                'operator',
                                e.target.value,
                              )
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
                            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 placeholder:font-normal placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                            placeholder="비교할 값"
                            value={condition.value}
                            onChange={(e) =>
                              handleUpdateCondition(
                                caseIndex,
                                conditionIndex,
                                'value',
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      );
                    })
                  )}

                  <button
                    onClick={() => handleAddCondition(caseIndex)}
                    className="w-full py-1.5 text-xs font-medium text-gray-600 border border-dashed border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  >
                    + 조건 추가
                  </button>
                </div>
              </div>
            );
          })}

          {cases.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded border border-dashed border-gray-300 text-gray-400 text-xs">
              분기가 없습니다. <br />+ 버튼을 눌러 분기를 추가하세요.
            </div>
          )}

          {/* Default 안내 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden border-l-4 border-l-gray-400">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-700">Default</div>
            </div>
            <div className="p-3 text-xs text-gray-500">
              위의 모든 조건이 만족하지 않으면 이 분기로 진행됩니다.
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
