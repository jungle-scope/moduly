import React, { useEffect, useMemo, useState } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  WorkflowNodeData,
  WorkflowVariable,
  WorkflowNodeInput,
} from '../../../../types/Nodes';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { toast } from 'sonner';

interface WorkflowNodePanelProps {
  nodeId: string;
  data: WorkflowNodeData;
}

export const WorkflowNodePanel: React.FC<WorkflowNodePanelProps> = ({
  nodeId,
  data,
}) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const [targetVariables, setTargetVariables] = useState<WorkflowVariable[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. 대상 워크플로우 정보 가져오기
  useEffect(() => {
    const loadTargetWorkflow = async () => {
      if (!data.workflowId) return;

      setIsLoading(true);
      setError(null);
      try {
        // 내 앱이므로 draft 접근 가능 가정
        const draft = await workflowApi.getDraftWorkflow(data.workflowId);

        if (draft && draft.nodes) {
          // Start 노드 찾기
          const startNode = draft.nodes.find(
            (n: any) => n.type === 'startNode' || n.type === 'start',
          );

          // Answer 노드를 찾아 출력 변수 추출
          const answerNode = draft.nodes.find(
            (n: any) => n.type === 'answerNode',
          );
          const outputKeys =
            (answerNode?.data?.outputs as any[])?.map((o) => o.variable) || [];

          // 변경사항이 있다면 outputs 업데이트
          if (JSON.stringify(data.outputs) !== JSON.stringify(outputKeys)) {
            updateNodeData(nodeId, { outputs: outputKeys });
          }

          if (startNode && startNode.data && startNode.data.variables) {
            setTargetVariables(startNode.data.variables);
          } else {
            setTargetVariables([]);
          }
        }
      } catch (err: any) {
        console.error('Failed to load target workflow:', err);
        setError('타겟 워크플로우 정보를 불러오지 못했습니다.');
        if (err.response?.status === 403) {
          setError('권한이 없습니다 (다른 사람의 비공개 앱일 수 있습니다).');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTargetWorkflow();
  }, [data.workflowId]);

  // 2. 매핑을 위한 상위 노드 목록 (Upstream Nodes)
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  // 3. 선택자(Selector) 업데이트 처리
  const handleSelectorUpdate = (
    targetVarName: string,
    position: 0 | 1,
    value: string,
  ) => {
    const currentInputs = [...(data.inputs || [])];
    const existingIdx = currentInputs.findIndex(
      (i) => i.name === targetVarName,
    );

    let newInput: WorkflowNodeInput;

    if (existingIdx !== -1) {
      // Update existing
      newInput = { ...currentInputs[existingIdx] };
      const selector = [...newInput.value_selector];

      // Ensure array size
      if (selector.length < 2) {
        selector[0] = selector[0] || '';
        selector[1] = selector[1] || '';
      }

      selector[position] = value;
      // 노드 변경 시 출력값 초기화
      if (position === 0) {
        selector[1] = '';
      }
      newInput.value_selector = selector;
      currentInputs[existingIdx] = newInput;
    } else {
      // Create new
      const selector = ['', ''];
      selector[position] = value;
      newInput = {
        name: targetVarName,
        value_selector: selector,
      };
      currentInputs.push(newInput);
    }

    updateNodeData(nodeId, { inputs: currentInputs });
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading target workflow info...
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">
          Input Parameters
        </label>
        <p className="text-xs text-gray-500 mb-2">
          대상 워크플로우의 <b>Start Node</b>에 정의된 변수에 값을 전달합니다.
        </p>

        {targetVariables.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-300 rounded">
            입력 변수가 없는 워크플로우입니다.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {targetVariables.map((targetVar) => {
              // 현재 매핑 찾기
              const mapping = data.inputs?.find(
                (i) => i.name === targetVar.name,
              );
              const selectedNodeId = mapping?.value_selector?.[0] || '';
              const selectedOutputKey = mapping?.value_selector?.[1] || '';

              const selectedNode = nodes.find((n) => n.id === selectedNodeId);
              const availableOutputs = selectedNode
                ? getNodeOutputs(selectedNode)
                : [];

              return (
                <div
                  key={targetVar.id}
                  className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">
                        {targetVar.name}
                      </span>
                      <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-gray-200 rounded-full">
                        {targetVar.type}
                      </span>
                    </div>
                    {targetVar.required && (
                      <span className="text-[10px] text-red-500">
                        *Required
                      </span>
                    )}
                  </div>

                  <div className="flex flex-row gap-2 items-center">
                    {/* 노드 선택 */}
                    <div className="flex-[1]">
                      <select
                        className="w-full rounded border border-gray-300 p-1.5 text-xs truncate"
                        value={selectedNodeId}
                        onChange={(e) =>
                          handleSelectorUpdate(
                            targetVar.name,
                            0,
                            e.target.value,
                          )
                        }
                      >
                        <option value="">노드 선택</option>
                        {upstreamNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {(n.data.title as string) || n.type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 출력 선택 */}
                    <div className="flex-[1] relative">
                      <select
                        className={`w-full rounded border p-1.5 text-xs truncate ${
                          !selectedNodeId
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'border-gray-300 bg-white'
                        }`}
                        value={selectedOutputKey}
                        onChange={(e) =>
                          handleSelectorUpdate(
                            targetVar.name,
                            1,
                            e.target.value,
                          )
                        }
                        disabled={!selectedNodeId}
                      >
                        <option value="">
                          {!selectedNodeId ? '변수 선택' : '출력 선택'}
                        </option>
                        {availableOutputs.map((outKey) => (
                          <option key={outKey} value={outKey}>
                            {outKey}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
