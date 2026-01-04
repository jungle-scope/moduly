import { useState, useEffect, useRef } from 'react';
import {
  WebhookTriggerNodeData,
  VariableMapping,
} from '../../../../types/Nodes';
import { CollapsibleSection } from '../../../ui/CollapsibleSection';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { appApi } from '@/app/features/app/api/appApi';
import { webhookApi } from '@/app/features/workflow/api/webhookApi';
import { toast } from 'sonner';
import { PayloadViewerModal } from './PayloadViewerModal';

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
  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflowId = useWorkflowStore((state) => state.activeWorkflowId);

  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);
  const [urlSlug, setUrlSlug] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [capturedPayload, setCapturedPayload] = useState<Record<
    string,
    unknown
  > | null>(null);

  // 폴링 interval과 timeout을 저장하기 위한 ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 현재 워크플로우의 appId 가져오기
  const currentWorkflow = workflows.find((w) => w.id === activeWorkflowId);
  const appId = currentWorkflow?.appId;

  // App 정보를 가져와서 Webhook URL 생성 (컴포넌트 마운트 시 1회만)
  useEffect(() => {
    const fetchAppAndGenerateUrl = async () => {
      if (!appId) {
        setWebhookUrl('App 정보를 불러올 수 없습니다');
        setIsLoadingUrl(false);
        return;
      }

      try {
        const app = await appApi.getApp(appId);
        if (app.url_slug) {
          setUrlSlug(app.url_slug);
          const baseUrl = window.location.origin; // 추후 gateway 등록시 수정 필요
          const token = app.auth_secret || '[auth-secret]';
          const url = `${baseUrl}/api/v1/hooks/${app.url_slug}?token=${token}`;
          setWebhookUrl(url);
        } else {
          setWebhookUrl('URL Slug가 없습니다');
        }
      } catch (error) {
        console.error('Failed to fetch app:', error);
        setWebhookUrl('URL 생성 실패');
      } finally {
        setIsLoadingUrl(false);
      }
    };

    fetchAppAndGenerateUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    toast.success('Webhook URL이 클립보드에 복사되었습니다!', {
      duration: 2000,
    });
  };

  const handleStartCapture = async () => {
    if (!urlSlug) {
      console.error('No url_slug available');
      return;
    }

    try {
      await webhookApi.startCapture(urlSlug);
      setIsCaptureMode(true);

      // 폴링 시작: 2초마다 상태 확인
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await webhookApi.getCaptureStatus(urlSlug);
          if (status.status === 'captured' && status.payload) {
            // Payload 캡처 성공
            setCapturedPayload(status.payload);
            setIsModalOpen(true);
            handleCancelCapture();
            toast.success('Webhook Payload가 캡처되었습니다!', {
              duration: 3000,
            });
          }
        } catch (error) {
          console.error('Failed to get capture status:', error);
        }
      }, 2000);

      // 30초 후 자동 취소
      timeoutRef.current = setTimeout(() => {
        handleCancelCapture();
      }, 30000);
    } catch (error) {
      console.error('Failed to start capture:', error);
      toast.error('캡처 시작에 실패했습니다.');
    }
  };

  const handleCancelCapture = () => {
    // Interval과 timeout 정리
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCaptureMode(false);
  };

  return (
    <>
      <PayloadViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        payload={capturedPayload}
      />
      <div className="flex flex-col gap-2">
        {/* Webhook URL Section */}
        <CollapsibleSection title="Webhook URL">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={isLoadingUrl ? '로딩 중...' : webhookUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50"
              />
              <button
                onClick={handleCopyUrl}
                disabled={isLoadingUrl}
                className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                title="Copy URL"
              >
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            {!isCaptureMode ? (
              <button
                onClick={handleStartCapture}
                disabled={isLoadingUrl || !urlSlug}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded hover:bg-purple-600 disabled:bg-gray-300 transition-colors"
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
    </>
  );
}
