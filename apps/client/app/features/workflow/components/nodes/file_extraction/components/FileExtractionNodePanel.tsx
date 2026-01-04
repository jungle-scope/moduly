import React, { useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { FileExtractionNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';

interface FileExtractionNodePanelProps {
  nodeId: string;
  data: FileExtractionNodeData;
}

export const FileExtractionNodePanel: React.FC<
  FileExtractionNodePanelProps
> = ({ nodeId, data }) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore();

  // Upstream Nodes 가져오기
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  // 파일 경로 변수 선택 업데이트
  const handleSelectorUpdate = (position: 0 | 1, value: string) => {
    const currentSelector = [...(data.file_path_variable || ['', ''])];

    currentSelector[position] = value;

    // 노드 선택 시 변수 선택 초기화
    if (position === 0) {
      currentSelector[1] = '';
    }

    updateNodeData(nodeId, {
      file_path_variable: currentSelector as [string, string],
    });
  };

  // 선택된 노드 정보
  const selectedNodeId = data.file_path_variable?.[0] || '';
  const selectedVarKey = data.file_path_variable?.[1] || '';

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const availableOutputs = selectedNode ? getNodeOutputs(selectedNode) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* File Path Variable Selector */}
      <CollapsibleSection title="File Path Variable">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 mb-1">
            추출할 PDF 파일의 경로를 가져올 변수를 선택하세요.
          </p>

          <div className="flex flex-col gap-2">
            {/* Node Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Source Node
              </label>
              <select
                className="w-full rounded border border-gray-300 p-2 text-sm truncate focus:outline-none focus:border-blue-500"
                value={selectedNodeId}
                onChange={(e) => handleSelectorUpdate(0, e.target.value)}
              >
                <option value="">노드 선택</option>
                {upstreamNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {(n.data.title as string) || n.type}
                  </option>
                ))}
              </select>
            </div>

            {/* Variable Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Variable
              </label>
              <select
                className={`w-full rounded border p-2 text-sm truncate focus:outline-none focus:border-blue-500 ${
                  !selectedNodeId
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : 'border-gray-300 bg-white'
                }`}
                value={selectedVarKey}
                onChange={(e) => handleSelectorUpdate(1, e.target.value)}
                disabled={!selectedNodeId}
              >
                <option value="">
                  {!selectedNodeId ? '먼저 노드를 선택해주세요' : '변수 선택'}
                </option>
                {availableOutputs.map((outKey) => (
                  <option key={outKey} value={outKey}>
                    {outKey}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Box */}
          {selectedNodeId && selectedVarKey && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              ✓ Selected: <span className="font-mono">{selectedNodeId}</span> →{' '}
              <span className="font-mono">{selectedVarKey}</span>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
