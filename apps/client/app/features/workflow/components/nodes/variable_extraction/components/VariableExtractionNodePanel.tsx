import { useMemo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { VariableExtractionNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { RoundedSelect } from '../../../ui/RoundedSelect';

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
        title="추출 변수"
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddMapping();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Add Mapping"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            키가 없으면 <span className="font-medium">null</span>로 반환됩니다.
          </p>
          {data.mappings?.length ? (
            data.mappings.map((mapping, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 border rounded bg-gray-50"
              >
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={mapping.name}
                    onChange={(e) =>
                      handleUpdateMapping(index, 'name', e.target.value)
                    }
                    placeholder="변수명 (예: discount_revenue)"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                  <input
                    type="text"
                    value={mapping.json_path}
                    onChange={(e) =>
                      handleUpdateMapping(index, 'json_path', e.target.value)
                    }
                    placeholder="JSON 경로 (예: data.discount_revenue)"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
                <button
                  onClick={() => handleRemoveMapping(index)}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              추출 변수가 없습니다. + 버튼을 눌러 추가하세요.
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
