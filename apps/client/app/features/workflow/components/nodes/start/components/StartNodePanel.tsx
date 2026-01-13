import { StartNodeData } from '../../../../types/Nodes';
import { useVariableManager } from '../hooks/useVariableManager';
import { VariableList } from './VariableList';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Plus } from 'lucide-react';

interface StartNodePanelProps {
  nodeId: string;
  data: StartNodeData;
}

/**
 * StartNodePanel
 * Start 노드의 세부 설정 패널 콘텐츠
 */
export function StartNodePanel({ nodeId, data }: StartNodePanelProps) {
  const {
    variables,
    addVariable,
    updateVariable,
    deleteVariable,
    moveVariable,
  } = useVariableManager(nodeId, data);

  return (
    <div className="flex flex-col gap-2">
      {/* Input Section */}
      <CollapsibleSection
        title="입력변수"
        showDivider
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              addVariable();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Add Variable"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 leading-snug">
            워크플로우 실행 시 사용자로부터 받을 입력 변수를 정의하세요.
          </p>
          <VariableList
            variables={variables}
            onUpdate={updateVariable}
            onDelete={deleteVariable}
            onMove={moveVariable}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
