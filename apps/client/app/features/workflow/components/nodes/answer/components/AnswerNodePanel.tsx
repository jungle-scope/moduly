import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, X } from 'lucide-react';
import { AnswerNodeData, AnswerNodeOutput } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';

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
      <CollapsibleSection
        title="Output Variables"
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddOutput();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="변수 추가"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {data.outputs?.map((output, index) => {
            const selectedSourceNodeId = output.value_selector?.[0];
            const selectedOutputKey = output.value_selector?.[1];

            const selectedSourceNode = nodes.find(
              (n) => n.id === selectedSourceNodeId,
            );

            // 선택된 노드의 가능한 output 키 목록 (Template/LLM 방식)
            const availableOutputs = selectedSourceNode
              ? getNodeOutputs(selectedSourceNode)
              : [];

            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded border border-gray-200 p-2.5 bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="h-8 flex-1 rounded border border-gray-300 px-2 text-xs focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
                    placeholder="Output Key (e.g. result)"
                    value={output.variable}
                    onChange={(e) =>
                      handleUpdateOutput(index, 'variable', e.target.value)
                    }
                  />
                  <button
                    className="flex items-center justify-center h-8 w-8 text-red-500 hover:bg-red-50 rounded"
                    onClick={() => handleRemoveOutput(index)}
                    title="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 값 선택기 */}
                <div className="flex gap-2">
                  <select
                    className="h-8 w-1/2 rounded border border-gray-300 px-2 text-xs focus:border-blue-500 focus:outline-none bg-white truncate"
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

                  {/* Output 키 선택 (Template/LLM 방식) */}
                  <select
                    className={`h-8 w-1/2 rounded border px-2 text-xs focus:border-blue-500 focus:outline-none truncate ${
                      !selectedSourceNodeId
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : 'border-gray-300 bg-white'
                    }`}
                    value={selectedOutputKey || ''}
                    onChange={(e) => {
                      const currentNode = output.value_selector?.[0] || '';
                      handleUpdateOutput(index, 'value_selector', [
                        currentNode,
                        e.target.value,
                      ]);
                    }}
                    disabled={!selectedSourceNodeId}
                  >
                    <option value="">
                      {!selectedSourceNodeId ? '출력 선택' : '출력 키 선택'}
                    </option>
                    {availableOutputs.map((outKey) => (
                      <option key={outKey} value={outKey}>
                        {outKey}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}

          {(!data.outputs || data.outputs.length === 0) && (
            <div className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-200 rounded">
              No outputs defined.
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
