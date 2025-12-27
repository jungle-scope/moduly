import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StartNodeData } from '../../../../types/Nodes';
import { useVariableManager } from '../hooks/useVariableManager';
import { VariableList } from './VariableList';
import { TriggerSection } from './TriggerSection';

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

  const [basicSettingsOpen, setBasicSettingsOpen] = useState(true);
  const [inputSectionOpen, setInputSectionOpen] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      {/* Basic Settings Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setBasicSettingsOpen(!basicSettingsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700">
            Basic settings
          </span>
          {basicSettingsOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {basicSettingsOpen && (
          <div className="px-4 py-3 bg-white">
            <TriggerSection type={data.triggerType} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setInputSectionOpen(!inputSectionOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Input</span>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              ℹ️
            </span>
          </div>
          {inputSectionOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {inputSectionOpen && (
          <div className="px-4 py-3 bg-white">
            <VariableList
              variables={variables}
              onAdd={addVariable}
              onUpdate={updateVariable}
              onDelete={deleteVariable}
              onMove={moveVariable}
            />
          </div>
        )}
      </div>
    </div>
  );
}
