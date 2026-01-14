import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { FileExtractionNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';

interface FileExtractionNodeProps {
  id: string;
  data: FileExtractionNodeData;
  selected?: boolean;
}

export const FileExtractionNode: React.FC<FileExtractionNodeProps> = ({
  id,
  data,
  selected,
}) => {
  const { nodes, edges } = useWorkflowStore();

  // upstream 노드들 가져오기
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(id, nodes, edges);
  }, [id, nodes, edges]);

  // 각 변수에 대해 배지 + 경로 형식으로 표시
  const variableLabels = useMemo(() => {
    if (!data.referenced_variables || data.referenced_variables.length === 0) {
      return null;
    }

    return data.referenced_variables.map((variable, idx) => {
      const [sourceNodeId, outputKey] = variable.value_selector || [];
      const sourceNode = upstreamNodes.find((n) => n.id === sourceNodeId);

      if (sourceNode && outputKey) {
        const nodeTitle =
          (sourceNode.data as { title?: string })?.title || sourceNode.type;
        const sourcePath = `${nodeTitle}.${outputKey}`;

        return (
          <div key={idx} className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-semibold uppercase tracking-wide">
              file
            </span>
            <span className="flex-1 truncate font-mono text-[10px] text-gray-500">
              {sourcePath}
            </span>
          </div>
        );
      }

      return (
        <div key={idx} className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-400 font-semibold uppercase tracking-wide">
            file
          </span>
          <span className="flex-1 truncate text-[10px] text-gray-400 italic">
            미선택
          </span>
        </div>
      );
    });
  }, [data.referenced_variables, upstreamNodes]);



  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      icon={<FileText className="text-white" />}
      iconColor="#6366f1" // indigo-500
    >
      <div className="flex flex-col gap-2 p-1">
        {variableLabels || (
          <div className="text-xs text-gray-400">
            문서를 추출할 파일을 선택해주세요
          </div>
        )}
        

      </div>
    </BaseNode>
  );
};
