import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  WebhookTriggerNodeData,
  VariableMapping,
} from '../../../../types/Nodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Plus, Copy, Trash2, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { appApi } from '@/app/features/app/api/appApi';
import { webhookApi } from '@/app/features/workflow/api/webhookApi';
import { toast } from 'sonner';
import { PayloadViewerModal } from './PayloadViewerModal';

interface WebhookTriggerNodePanelProps {
  nodeId: string;
  data: WebhookTriggerNodeData;
}

// 간단한 Portal Tooltip 컴포넌트
function PortalTooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      // 화면 오른쪽 끝에서 잘리는 것 방지
      const tooltipWidth = 240; // 예상 너비 (w-60 ~ 240px)
      let left = rect.left + scrollX + rect.width / 2 - tooltipWidth + 20; // 기본: 우측 정렬 느낌으로
      if (left < 10) left = 10; // 왼쪽 화면 밖 방지

      setCoords({
        top: rect.bottom + scrollY + 5,
        left: left,
      });
      setIsVisible(true);
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        className={className || 'inline-flex items-center'}
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
            }}
            className="w-60 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-normal break-keep"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
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
  const [webhookUrlWithToken, setWebhookUrlWithToken] = useState<string>('');
  const [authSecret, setAuthSecret] = useState<string>('');
  const [showSecret, setShowSecret] = useState(false);
  const [urlFormat, setUrlFormat] = useState<'integrated' | 'standard'>(
    'standard',
  ); // 통합 URL vs 표준 API
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
          const baseUrl = window.location.origin;
          const secret = app.auth_secret || '[auth-secret]';

          // 분리 방식: URL만
          const url = `${baseUrl}/api/v1/hooks/${app.url_slug}`;
          setWebhookUrl(url);

          // 통합 방식: URL + Query Parameter
          const urlWithToken = `${baseUrl}/api/v1/hooks/${app.url_slug}?token=${secret}`;
          setWebhookUrlWithToken(urlWithToken);

          // Secret 저장
          setAuthSecret(secret);
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

  const handleCopySecret = () => {
    navigator.clipboard.writeText(authSecret);
    toast.success('Secret Key가 클립보드에 복사되었습니다!', {
      duration: 2000,
    });
  };

  const handleCopyFullUrl = () => {
    navigator.clipboard.writeText(webhookUrlWithToken);
    toast.success('통합 URL이 클립보드에 복사되었습니다!', {
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

  const handlePayloadSelect = (path: string, value: any) => {
    // 변수명 자동 생성: 경로의 마지막 부분 (e.g. issue.fields.summary -> summary)
    // 숫자로만 된 건 제외하거나 prefix 붙임 (e.g. issues[0] -> issues_0)
    let varName = path.split('.').pop() || 'variable';
    varName = varName.replace(/\[(\d+)\]/g, '_$1'); // array index handling

    // 이미 존재하는 변수명인지 확인 후 중복 시 숫자 붙임
    let finalVarName = varName;
    let counter = 1;
    while (
      data.variable_mappings.some((m) => m.variable_name === finalVarName)
    ) {
      finalVarName = `${varName}_${counter}`;
      counter++;
    }

    const newMapping: VariableMapping = {
      variable_name: finalVarName,
      json_path: path,
    };

    updateNodeData(nodeId, {
      variable_mappings: [...data.variable_mappings, newMapping],
    });

    toast.success(`변수 '${finalVarName}' (경로: ${path}) 추가됨!`);
  };

  return (
    <>
      <PayloadViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        payload={capturedPayload}
        onSelect={handlePayloadSelect}
      />
      <div className="flex flex-col gap-2">
        {/* Webhook URL Section */}
        <CollapsibleSection
          title={
            <div className="flex items-center gap-1.5">
              <span>웹훅 테스트</span>
              <div className="relative group flex items-center translate-y-[0.5px]">
                <PortalTooltip
                  content={
                    <div className="space-y-2">
                      <div>
                        캡처 시작 버튼을 누르고 트리거를 작동 시키면, 들어오는
                        JSON 구조를 자동으로 분석합니다. 필요한 값을 선택하여
                        변수로 자동매핑 해보세요.
                      </div>
                    </div>
                  }
                >
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                </PortalTooltip>
              </div>
            </div>
          }
        >
          <div className="space-y-0">
            {/* URL 형식 토글 */}
            <div className="pb-3">
              <div className="flex w-full rounded-md border border-gray-300 bg-gray-50 p-0.5">
                <PortalTooltip
                  className="flex-1 flex"
                  content={
                    <div>
                      <strong className="text-purple-300">통합 URL:</strong>{' '}
                      Jira, Slack 등 URL만 입력 가능한 서비스용 (인증키 포함)
                    </div>
                  }
                >
                  <button
                    onClick={() => setUrlFormat('integrated')}
                    className={`flex-1 px-4 py-1.5 text-xs font-medium rounded transition-colors ${
                      urlFormat === 'integrated'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    통합 URL
                  </button>
                </PortalTooltip>
                <PortalTooltip
                  className="flex-1 flex"
                  content={
                    <div>
                      <strong className="text-blue-300">표준 API:</strong> 자체
                      개발, GitHub 등 보안과 헤더 설정이 필요한 환경용 (권장)
                    </div>
                  }
                >
                  <button
                    onClick={() => setUrlFormat('standard')}
                    className={`flex-1 px-4 py-1.5 text-xs font-medium rounded transition-colors ${
                      urlFormat === 'standard'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    표준 API
                  </button>
                </PortalTooltip>
              </div>
            </div>

            {/* 통합 URL 방식 */}
            {urlFormat === 'integrated' && (
              <div className="pt-2">
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                  Webhook URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={isLoadingUrl ? '로딩 중...' : webhookUrlWithToken}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50"
                  />
                  <button
                    onClick={handleCopyFullUrl}
                    disabled={isLoadingUrl}
                    className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}

            {/* 표준 API 방식 */}
            {urlFormat === 'standard' && (
              <>
                <div className="pt-4">
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Webhook URL
                  </label>
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
                </div>

                <div className="pt-4">
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Secret Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={isLoadingUrl ? '로딩 중...' : authSecret}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border rounded bg-gray-50 font-mono"
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      disabled={isLoadingUrl}
                      className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      title={showSecret ? 'Hide' : 'Show'}
                    >
                      {showSecret ? (
                        <EyeOff className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={handleCopySecret}
                      disabled={isLoadingUrl}
                      className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      title="Copy Secret"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 캡처 버튼 */}
            <div className="pt-4">
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
          </div>
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
