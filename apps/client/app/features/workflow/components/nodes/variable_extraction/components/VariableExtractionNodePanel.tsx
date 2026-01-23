import { useMemo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { VariableExtractionNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { RoundedSelect } from '../../../ui/RoundedSelect';
import { JsonExtractionMappingControl } from './JsonExtractionMappingControl';

interface VariableExtractionNodePanelProps {
  nodeId: string;
  data: VariableExtractionNodeData;
}

export function VariableExtractionNodePanel({
  nodeId,
  data,
}: VariableExtractionNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const sourceSelector = data.source_selector || [];
  const selectedNodeId = sourceSelector[0] || '';
  const selectedOutputKey = sourceSelector[1] || '';

  const selectedNode = upstreamNodes.find((n) => n.id === selectedNodeId);
  const availableOutputs = selectedNode ? getNodeOutputs(selectedNode) : [];

  const handleSourceChange = useCallback(
    (position: 0 | 1, value: string) => {
      const nextSelector = [...(data.source_selector || [])];
      if (nextSelector.length < 2) {
        nextSelector[0] = nextSelector[0] || '';
        nextSelector[1] = nextSelector[1] || '';
      }

      nextSelector[position] = value;
      if (position === 0) {
        nextSelector[1] = '';
      }

      updateNodeData(nodeId, { source_selector: nextSelector });
    },
    [data.source_selector, nodeId, updateNodeData],
  );

  const handleAddMapping = useCallback(() => {
    updateNodeData(nodeId, {
      mappings: [...(data.mappings || []), { name: '', json_path: '' }],
    });
  }, [data.mappings, nodeId, updateNodeData]);

  const handleUpdateMapping = useCallback(
    (index: number, key: 'name' | 'json_path', value: string) => {
      const nextMappings = [...(data.mappings || [])];
      nextMappings[index] = { ...nextMappings[index], [key]: value };
      updateNodeData(nodeId, { mappings: nextMappings });
    },
    [data.mappings, nodeId, updateNodeData],
  );

  const handleRemoveMapping = useCallback(
    (index: number) => {
      const nextMappings = [...(data.mappings || [])];
      nextMappings.splice(index, 1);
      updateNodeData(nodeId, { mappings: nextMappings });
    },
    [data.mappings, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title="입력 데이터" showDivider>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            추출할 JSON 출력을 선택하세요.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <RoundedSelect
              value={selectedNodeId}
              onChange={(val) => handleSourceChange(0, String(val))}
              options={[
                { label: '노드 선택', value: '' },
                ...upstreamNodes.map((n) => ({
                  label: (n.data as { title?: string })?.title || n.type,
                  value: n.id,
                })),
              ]}
              placeholder="노드 선택"
              className="py-1.5 text-xs"
            />
            <RoundedSelect
              value={selectedOutputKey}
              onChange={(val) => handleSourceChange(1, String(val))}
              options={[
                {
                  label: !selectedNodeId ? '출력 선택' : '출력값 선택',
                  value: '',
                },
                ...availableOutputs.map((outKey) => ({
                  label: outKey,
                  value: outKey,
                })),
              ]}
              disabled={!selectedNodeId}
              placeholder={!selectedNodeId ? '출력 선택' : '출력값 선택'}
              className="py-1.5 text-xs"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="데이터 필터 설정"
        showDivider
      >
        <JsonExtractionMappingControl
          mappings={data.mappings || []}
          onUpdate={handleUpdateMapping}
          onAdd={handleAddMapping}
          onRemove={handleRemoveMapping}
          title=""
          description="💡 입력 데이터에서 필요한 값만 골라냅니다. 가져올 데이터의 키(Key)를 입력하세요. (예: result, user.name) 추출된 값은 이 변수명으로 다른 노드에서 사용할 수 있습니다."
        />
      </CollapsibleSection>
    </div>
  );
}
