import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, X } from 'lucide-react';
import { AnswerNodeData, AnswerNodeOutput } from './AnswerNode';
import { StartNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';

interface AnswerNodePanelProps {
  nodeId: string;
  data: AnswerNodeData;
}

export function AnswerNodePanel({ nodeId, data }: AnswerNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleAddOutput = useCallback(() => {
    const newOutputs = [
      ...(data.outputs || []),
      { variable: '', value_selector: [] },
    ];
    updateNodeData(nodeId, { outputs: newOutputs });
  }, [data.outputs, nodeId, updateNodeData]);

  const handleUpdateOutput = useCallback(
    (
      index: number,
      field: keyof AnswerNodeOutput,
      value: string | string[],
    ) => {
      const newOutputs = [...(data.outputs || [])];
      newOutputs[index] = { ...newOutputs[index], [field]: value };
      updateNodeData(nodeId, { outputs: newOutputs });
    },
    [data.outputs, nodeId, updateNodeData],
  );

  const handleRemoveOutput = useCallback(
    (index: number) => {
      const newOutputs = [...(data.outputs || [])];
      newOutputs.splice(index, 1);
      updateNodeData(nodeId, { outputs: newOutputs });
    },
    [data.outputs, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">
            출력 변수 설정
          </span>
          <button
            onClick={handleAddOutput}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {data.outputs?.map((output, index) => {
            const selectedSourceNodeId = output.value_selector?.[0];
            const selectedSourceNode = nodes.find(
              (n) => n.id === selectedSourceNodeId,
            );

            // 소스 노드에서 변수 가져오기
            let sourceVariables: { label: string; value: string }[] = [];
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
              sourceVariables = (startData.variables || []).map((v) => ({
                label: v.name, // 드롭다운에는 이름 표시 (사용자 가독성)
                value: v.id, // 저장할 때는 ID 사용 (참조 안정성)
              }));
            }
            // 필요한 경우 다른 노드 유형 추가 (예: LLM 결과)

            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded border border-gray-200 p-3 bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="출력 키 (예: result)"
                    value={output.variable}
                    onChange={(e) =>
                      handleUpdateOutput(index, 'variable', e.target.value)
                    }
                  />
                  <button
                    className="flex items-center justify-center h-8 w-8 text-red-500 hover:bg-red-50 rounded"
                    onClick={() => handleRemoveOutput(index)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 값 선택기 */}
                <div className="flex gap-2">
                  <select
                    className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    value={output.value_selector?.[0] || ''}
                    onChange={(e) => {
                      const currentKey = ''; // 노드 변경 시 키 재설정
                      handleUpdateOutput(index, 'value_selector', [
                        e.target.value,
                        currentKey,
                      ]);
                    }}
                  >
                    <option value="" disabled>
                      노드 선택
                    </option>
                    {upstreamNodes
                      .filter((n) => n.type !== 'note')
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {(n.data as { title?: string })?.title || n.type}
                        </option>
                      ))}
                  </select>

                  {/* 동적 소스 변수 입력/선택 */}
                  <select
                    className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    value={output.value_selector?.[1] || ''}
                    onChange={(e) => {
                      const currentNode = output.value_selector?.[0] || '';
                      handleUpdateOutput(index, 'value_selector', [
                        currentNode,
                        e.target.value,
                      ]);
                    }}
                    disabled={sourceVariables.length === 0}
                  >
                    <option value="" disabled>
                      {sourceVariables.length === 0 ? '변수 없음' : '변수 선택'}
                    </option>
                    {sourceVariables.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}

          {(!data.outputs || data.outputs.length === 0) && (
            <div className="text-center text-sm text-gray-400 py-4">
              출력 변수가 없습니다. <br />+ 버튼을 눌러 추가하세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
