import React, { useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { FileExtractionNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

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
  // ReferencedVariablesControl을 위한 어댑터
  const variables = useMemo(
    () => [
      {
        name: '',
        value_selector: data.file_path_variable || ['', ''],
      },
    ],
    [data.file_path_variable],
  );

  const handleUpdateVariable = (
    index: number,
    field: 'name' | 'value_selector',
    value: string | string[],
  ) => {
    if (field === 'value_selector') {
      updateNodeData(nodeId, {
        file_path_variable: value as [string, string],
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 파일 경로 변수 선택기 */}
      <CollapsibleSection title="File Path Variable">
        <ReferencedVariablesControl
          variables={variables}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={() => {}}
          onRemove={() => {}}
          title=""
          description="추출할 PDF 파일의 경로를 가져올 변수를 선택하세요."
          showAddButton={false}
          showRemoveButton={false}
          showItemLabel={false}
          hideAlias={true}
        />
      </CollapsibleSection>
    </div>
  );
};
