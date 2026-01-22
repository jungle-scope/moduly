import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { AnswerNodeData, AnswerNodeOutput } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

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

  // ReferencedVariablesControl을 위한 어댑터
  const variables = useMemo(() => {
    return (data.outputs || []).map((output) => ({
      name: output.variable,
      value_selector: output.value_selector || [],
    }));
  }, [data.outputs]);

  const handleAddOutput = useCallback(() => {
    const newOutputs = [
      ...(data.outputs || []),
      { variable: '', value_selector: [] },
    ];
    updateNodeData(nodeId, { outputs: newOutputs });
  }, [data.outputs, nodeId, updateNodeData]);

  const handleUpdateOutput = useCallback(
    (index: number, key: keyof AnswerNodeOutput | 'name', value: any) => {
      const newOutputs = [...(data.outputs || [])];
      // 'name'을 'variable'로 다시 매핑
      if (key === 'name') {
        newOutputs[index] = { ...newOutputs[index], variable: value };
      } else {
        newOutputs[index] = {
          ...newOutputs[index],
          [key as keyof AnswerNodeOutput]: value,
        };
      }
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
      <CollapsibleSection title="입력변수" showDivider>
        <ReferencedVariablesControl
          variables={variables}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateOutput}
          onAdd={handleAddOutput}
          onRemove={handleRemoveOutput}
          title=""
          description="최종 출력으로 내보낼 변수를 정의합니다."
        />
      </CollapsibleSection>
    </div>
  );
}
