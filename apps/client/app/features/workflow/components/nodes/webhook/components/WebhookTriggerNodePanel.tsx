import { useState } from 'react';
import {
  WebhookTriggerNodeData,
  VariableMapping,
} from '../../../../types/Nodes';
import { CollapsibleSection } from '../../../ui/CollapsibleSection';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';

interface WebhookTriggerNodePanelProps {
  nodeId: string;
  data: WebhookTriggerNodeData;
}

/**
 * WebhookTriggerNodePanel
 * Webhook Trigger 노드의 세부 설정 패널
 */
export function WebhookTriggerNodePanel({
  nodeId,
  data,
}: WebhookTriggerNodePanelProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  // Webhook URL 생성 (app의 url_slug + auth_secret 조합)
  const webhookUrl = `${window.location.origin}/api/v1/hooks/[app-slug]?token=[auth-secret]`;

  const handleProviderChange = (provider: 'jira' | 'custom') => {
    updateNodeData(nodeId, { provider });
  };

  const handleAddMapping = () => {
    const newMapping: VariableMapping = {
      variable_name: '',
      json_path: '',
    };
    updateNodeData(nodeId, {
      variable_mappings: [...data.variable_mappings, newMapping],
    });
  };

  const handleUpdateMapping = (
    index: number,
    field: keyof VariableMapping,
    value: string,
  ) => {
    const updatedMappings = [...data.variable_mappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      [field]: value,
    };
    updateNodeData(nodeId, { variable_mappings: updatedMappings });
  };

  const handleDeleteMapping = (index: number) => {
    const updatedMappings = data.variable_mappings.filter(
      (_, i) => i !== index,
    );
    updateNodeData(nodeId, { variable_mappings: updatedMappings });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    // TODO: Show toast notification
  };

  const handleStartCapture = async () => {
    setIsCaptureMode(true);
    // TODO: Call API to start capture
    // GET /api/v1/hooks/{slug}/capture/start
  };

  const handleCancelCapture = () => {
    setIsCaptureMode(false);
    // TODO: Call API to cancel capture (optional)
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Webhook URL Section */}
      <CollapsibleSection title="Webhook URL">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50"
            />
            <button
              onClick={handleCopyUrl}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Copy URL"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {!isCaptureMode ? (
            <button
              onClick={handleStartCapture}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded hover:bg-purple-600 transition-colors"
            >
              캡처 시작
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded border border-purple-200">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                수신 대기 중...
              </div>
              <button
                onClick={handleCancelCapture}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Provider Section */}
      <CollapsibleSection title="연동 서비스">
        <select
          value={data.provider}
          onChange={(e) =>
            handleProviderChange(e.target.value as 'jira' | 'custom')
          }
          className="w-full px-3 py-2 text-sm border rounded bg-white hover:border-purple-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        >
          <option value="custom">Custom</option>
          <option value="jira">Jira</option>
        </select>
      </CollapsibleSection>

      {/* Variable Mapping Section */}
      <CollapsibleSection
        title="Variable Mapping"
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
          {data.variable_mappings.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              변수 매핑이 없습니다. + 버튼을 눌러 추가하세요.
            </p>
          ) : (
            data.variable_mappings.map((mapping, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 border rounded bg-gray-50"
              >
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={mapping.variable_name}
                    onChange={(e) =>
                      handleUpdateMapping(
                        index,
                        'variable_name',
                        e.target.value,
                      )
                    }
                    placeholder="변수명 (예: issue_key)"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                  <input
                    type="text"
                    value={mapping.json_path}
                    onChange={(e) =>
                      handleUpdateMapping(index, 'json_path', e.target.value)
                    }
                    placeholder="JSON 경로 (예: issue.key)"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
                <button
                  onClick={() => handleDeleteMapping(index)}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
