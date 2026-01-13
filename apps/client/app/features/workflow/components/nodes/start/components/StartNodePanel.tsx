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
        title="Input"
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
        <VariableList
          variables={variables}
          onUpdate={updateVariable}
          onDelete={deleteVariable}
          onMove={moveVariable}
        />
      </CollapsibleSection>
    </div>
  );
}
