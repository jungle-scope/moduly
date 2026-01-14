import React, { useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { FileExtractionNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getIncompleteVariables } from '../../../../utils/validationUtils';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';
import { IncompleteVariablesAlert } from '../../../ui/IncompleteVariablesAlert';

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

  // 변수 추가 핸들러
  const handleAddVariable = () => {
    updateNodeData(nodeId, {
      referenced_variables: [
        ...(data.referenced_variables || []),
        { name: '', value_selector: [] },
      ],
    });
  };

  // 변수 제거 핸들러
  const handleRemoveVariable = (index: number) => {
    const newVars = [...(data.referenced_variables || [])];
    newVars.splice(index, 1);
    updateNodeData(nodeId, { referenced_variables: newVars });
  };

  // 변수 업데이트 핸들러
  const handleUpdateVariable = (
    index: number,
    field: 'name' | 'value_selector',
    value: string | string[],
  ) => {
    const newVars = [...(data.referenced_variables || [])];
    newVars[index] = { ...newVars[index], [field]: value };
    updateNodeData(nodeId, { referenced_variables: newVars });
  };

  // [VALIDATION] 불완전한 변수 (이름은 있지만 selector가 불완전한 경우)
  const incompleteVariables = useMemo(
    () => getIncompleteVariables(data.referenced_variables),
    [data.referenced_variables]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 파일 경로 변수 선택기 */}
      <CollapsibleSection title="입력 변수">
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title=""
          description="텍스트를 추출할 파일을 선택하세요"
          showAddButton={true}
          showRemoveButton={true}
          showItemLabel={true}
          hideAlias={false}
        />

        {/* [VALIDATION] 불완전한 변수 경고 */}
        <IncompleteVariablesAlert variables={incompleteVariables} />
      </CollapsibleSection>
    </div>
  );
};
