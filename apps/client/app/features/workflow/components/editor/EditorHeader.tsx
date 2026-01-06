'use client';

import { toast } from 'sonner';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ClockIcon } from '@/app/features/workflow/components/nodes/icons';
// [NEW] 로그 뷰어 모달 Import
import { LogViewerModal } from '@/app/features/workflow/components/logs/LogViewerModal';
// [NEW] 모니터링 대시보드 모달 Import
import { MonitoringDashboardModal } from '@/app/features/workflow/components/monitoring/MonitoringDashboardModal';
import { ScrollText, BarChart3, Play } from 'lucide-react'; // [NEW] 아이콘 추가
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  validateVariableName,
  validateVariableSettings,
} from '../nodes/start/hooks/useVariableManager';
import { StartNodeData, WorkflowVariable } from '../../types/Nodes';
import { workflowApi } from '../../api/workflowApi';
import { UserInputModal } from '../modals/userInputModal';
import { ResultModal } from '../modals/ResultModal';
import { DeploymentModal } from '../modals/DeploymentModal';
import { DeploymentResultModal } from '../modals/DeploymentResultModal';
import { InputSchema, OutputSchema } from '../../types/Deployment';
import { VersionHistorySidebar } from './VersionHistorySidebar';
import { MemoryModeToggle, useMemoryMode } from './memory/MemoryModeControls';

/** SY.
 * url_slug: 위젯 배포 등 URL이 없는 경우 대비 null
 * auth_secret: 누구나 접근 가능한 Public 배포시 null
 * webAppUrl: 웹 앱 배포 시 공유 링크
 * */
type DeploymentResult =
  | {
      success: true;
      url_slug: string | null;
      auth_secret: string | null;
      version: number;
      webAppUrl?: string; // 웹 앱 URL (선택적)
      embedUrl?: string; // 임베딩 URL (선택적)
      isWorkflowNode?: boolean; // 워크플로우 노드 배포 여부 (선택적)
      input_schema?: InputSchema | null;
      output_schema?: OutputSchema | null;
    }
  | { success: false; message: string }
  | null;

export default function EditorHeader() {
  const router = useRouter();
  const params = useParams();
  const workflowId = (params.id as string) || 'default'; // URL에서 ID 파싱
  const {
    projectName,
    projectIcon,
    nodes,
    // Version History State
    previewingVersion,
    exitPreview,
    restoreVersion,
    toggleVersionHistory,
    runTrigger,
  } = useWorkflowStore();
  const { setCenter } = useReactFlow(); // ReactFlow 뷰포트 제어 훅
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false); // [NEW] 로그 뷰어 모달 상태
  const [initialLogRunId, setInitialLogRunId] = useState<string | null>(null); // [NEW] 로그 뷰어 초기 진입 ID
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false); // [NEW] 모니터링 모달 상태
  const [returnToMonitoring, setReturnToMonitoring] = useState(false); // [NEW] 모니터링 복귀 상태
  const [monitoringScrollPos, setMonitoringScrollPos] = useState(0); // [NEW] 모니터링 스크롤 위치 저장

  // Existing State
  const [showModal, setShowModal] = useState(false);
  const [modalVariables, setModalVariables] = useState<WorkflowVariable[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Deployment State
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult>(null);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [deploymentType, setDeploymentType] = useState<
    'api' | 'webapp' | 'widget' | 'workflow_node'
  >('api'); // 배포 타입 추적

  const {
    isMemoryModeEnabled,
    hasProviderKey,
    memoryModeDescription,
    toggleMemoryMode,
    appendMemoryFlag,
    modals: memoryModeModals,
  } = useMemoryMode(router, toast);

  const handleBack = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleVersionHistory = useCallback(() => {
    toggleVersionHistory();
  }, [toggleVersionHistory]);

  const handleRestore = useCallback(async () => {
    if (!previewingVersion) return;
    if (
      confirm('현재 드래프트 내용을 덮어쓰고 이 버전으로 복원하시겠습니까?')
    ) {
      await restoreVersion(previewingVersion);
      toast.success('버전이 복원되었습니다.');
    }
  }, [previewingVersion, restoreVersion]);

  const handlePublishAsRestAPI = useCallback(() => {
    setDeploymentType('api'); // REST API 배포
    setShowDeployModal(true);
  }, []);

  const handlePublishAsWebApp = useCallback(() => {
    setDeploymentType('webapp'); // 웹 앱 배포
    setShowDeployModal(true);
  }, []);

  const handlePublishAsWidget = useCallback(() => {
    setDeploymentType('widget'); // 위젯 배포
    setShowDeployModal(true);
  }, []);

  // Store에서 workflows 가져오기 (appId 조회를 위해)
  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflow = workflows.find((w) => w.id === workflowId);

  // rest API로 배포
  const handleDeploySubmit = useCallback(
    async (description: string) => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        setIsDeploying(true);

        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: 'api',
          is_active: true,
        });
        console.log('[배포 성공] 서버 응답:', response);

        // 성공 결과 모달 표시
        setDeploymentResult({
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: response.auth_secret ?? null,
          version: response.version,
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        });

        // 배포 성공 알림 (버전 기록 갱신용)
        useWorkflowStore.getState().notifyDeploymentComplete();

        setShowDeployModal(false);
      } catch (error: any) {
        console.error('Deployment failed:', error);

        // 실패 결과 모달 표시
        setDeploymentResult({
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        });
        // 실패 시에도 입력 모달 닫기
        setShowDeployModal(false);
      } finally {
        setIsDeploying(false);
      }
    },
    [activeWorkflow?.appId],
  );

  // 웹 앱으로 배포
  const handleDeployAsWebApp = useCallback(
    async (description: string) => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        setIsDeploying(true);

        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: 'webapp',
          is_active: true,
        });
        console.log('[웹 앱 배포 성공] 서버 응답:', response);

        // 웹 앱 링크 생성
        const webAppUrl = `${window.location.origin}/shared/${response.url_slug}`;

        // 성공 결과 모달 표시 (공유 링크 포함)
        setDeploymentResult({
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: null, // 웹 앱은 API 키 표시 안 함
          version: response.version,
          webAppUrl, // 웹 앱 URL 추가
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        });

        useWorkflowStore.getState().notifyDeploymentComplete();

        setShowDeployModal(false);
      } catch (error: any) {
        console.error('Web app deployment failed:', error);

        // 실패 결과 모달 표시
        setDeploymentResult({
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        });
        setShowDeployModal(false);
      } finally {
        setIsDeploying(false);
      }
    },
    [activeWorkflow?.appId],
  );

  // 웹사이트 위젯으로 배포
  const handleDeployAsWidget = useCallback(
    async (description: string) => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        setIsDeploying(true);

        // 위젯으로 배포
        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: 'widget',
          is_active: true,
        });
        console.log('[위젯 배포 성공] 서버 응답:', response);

        // 임베딩 채팅 URL
        const embedUrl = `${window.location.origin}/embed/chat/${response.url_slug}`;

        // 성공 결과 모달 표시 (임베딩 스니펫 포함)
        setDeploymentResult({
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: null,
          version: response.version,
          embedUrl, // 임베딩 URL 추가
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        });

        useWorkflowStore.getState().notifyDeploymentComplete();

        setShowDeployModal(false);
      } catch (error: any) {
        console.error('Widget deployment failed:', error);

        setDeploymentResult({
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        });
        setShowDeployModal(false);
      } finally {
        setIsDeploying(false);
      }
    },
    [activeWorkflow?.appId],
  );

  const handlePublishAsWorkflowNode = useCallback(() => {
    setDeploymentType('workflow_node');
    setShowDeployModal(true);
  }, []);

  // 워크플로우 노드로 배포
  // 이 기능은 현재 워크플로우를 다른 워크플로우에서 사용할 수 있는 '커스텀 노드' 형태로 배포합니다.
  // 배포된 노드는 '워크플로우 노드' 카테고리에서 찾을 수 있습니다.
  const handleDeployAsWorkflowNode = useCallback(
    async (description: string) => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        setIsDeploying(true);

        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: 'workflow_node',
          is_active: true,
        });
        console.log('[워크플로우 노드 배포 성공] 서버 응답:', response);

        setDeploymentResult({
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: null,
          version: response.version,
          isWorkflowNode: true,
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        });

        useWorkflowStore.getState().notifyDeploymentComplete();

        setShowDeployModal(false);
      } catch (error: any) {
        console.error('Workflow node deployment failed:', error);

        setDeploymentResult({
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        });
        setShowDeployModal(false);
      } finally {
        setIsDeploying(false);
      }
    },
    [workflowId, activeWorkflow?.appId],
  );

  const handleTestRun = useCallback(async () => {
    setErrorMsg(null);

    // 1. StartNode 찾기
    const startNode = nodes.find(
      (node) => node.type === 'startNode' || node.type === 'webhookTrigger',
    );
    if (!startNode) {
      const errorContent =
        '시작 노드를 찾을 수 없습니다. 워크플로우에 시작 노드나 웹훅 트리거를 추가해주세요.';
      console.warn('start node가 없습니다.');
      setErrorMsg(errorContent);
      return;
    }

    // 2. 유효성 검사
    let variables: WorkflowVariable[] = [];

    if (startNode.type === 'startNode') {
      const data = startNode.data as StartNodeData;
      variables = data.variables || [];
      for (const variable of variables) {
        const otherNames = variables
          .filter((v) => v.id !== variable.id)
          .map((v) => v.name);
        let error = validateVariableName(
          variable.name,
          variable.label,
          otherNames,
        );
        if (!error) {
          error = validateVariableSettings(
            variable.type,
            variable.options,
            variable.maxLength,
          );
        }
        if (error) {
          const errorContent = `유효성 검사 실패: [${
            variable.label || variable.name
          }] ${error}`;
          console.warn(errorContent);
          setErrorMsg(errorContent);
          return;
        }
      }
    } else if (startNode.type === 'webhookTrigger') {
      // Webhook Trigger인 경우 전체 JSON Body를 입력받음
      variables = [
        {
          id: '__json_payload__',
          name: '__json_payload__',
          label: 'JSON Payload (Body)',
          type: 'paragraph',
          required: true,
          placeholder: '{"issue": {"key": "TEST-123"}}',
        },
      ];
    }

    // 3. 변수 저장 후 모달 표시
    setModalVariables(variables);
    setShowModal(true);
  }, [nodes]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleModalSubmit = useCallback(
    async (inputs: Record<string, any> | FormData) => {
      setShowModal(false);

      // 워크플로우 실행
      try {
        setIsExecuting(true);

        const startNode = nodes.find(
          (node) => node.type === 'startNode' || node.type === 'webhookTrigger',
        );

        if (startNode?.type === 'webhookTrigger') {
          // Webhook인 경우 __json_payload__를 파싱해서 inputs로 사용
          try {
            const rawJson =
              inputs instanceof FormData
                ? (inputs.get('__json_payload__') as string)
                : inputs['__json_payload__'];
            inputs = JSON.parse(rawJson);
          } catch (e) {
            console.error('JSON parsing failed:', e);
            toast.error('유효하지 않은 JSON 형식입니다.');
            return;
          }
        }

        const payload = appendMemoryFlag(inputs);

        // 1. 초기화: 모든 노드 상태 초기화
        const initialNodes = nodes.map((node) => ({
          ...node,
          data: { ...node.data, status: 'idle' },
        })) as unknown as any[];

        useWorkflowStore.getState().setNodes(initialNodes);

        let finalResult: any = null;

        // 2. 스트리밍 실행
        // 여기서 async 콜백을 사용하여 의도적인 지연(Delay)을 만듭니다.
        await workflowApi.executeWorkflowStream(
          workflowId,
          payload,
          async (event) => {
            // 시각적 피드백을 위한 지연 (너무 빠르면 사용자가 인지하기 힘듦)
            await new Promise((resolve) => setTimeout(resolve, 500));

            const { type, data } = event;

            if (type === 'node_start') {
              useWorkflowStore
                .getState()
                .updateNodeData(data.node_id, { status: 'running' });

              // 🎯 실행 중인 노드로 화면 중심 이동 및 줌인
              const latestNodes = useWorkflowStore.getState().nodes;
              const currentNode = latestNodes.find(
                (n) => n.id === data.node_id,
              );
              if (currentNode) {
                setCenter(
                  currentNode.position.x +
                    (currentNode.measured?.width || 200) / 2,
                  currentNode.position.y +
                    (currentNode.measured?.height || 100) / 2,
                  { zoom: 1.2, duration: 800 }, // 0.8초 동안 부드럽게 이동
                );
              }
            } else if (type === 'node_finish') {
              useWorkflowStore
                .getState()
                .updateNodeData(data.node_id, { status: 'success' }); // 실패 처리 등이 필요하면 여기에 추가

              // 🍞 노드 실행 완료 토스트 메시지
              toast.success(`[${data.node_type}] 실행 완료`, {
                description: `결과: ${JSON.stringify(data.output).slice(0, 50)}${JSON.stringify(data.output).length > 50 ? '...' : ''}`,
                duration: 2000,
              });
            } else if (type === 'workflow_finish') {
              finalResult = data;
            } else if (type === 'error') {
              if (data.node_id) {
                useWorkflowStore
                  .getState()
                  .updateNodeData(data.node_id, { status: 'failure' });
              }
              throw new Error(data.message);
            }
          },
        );

        console.log('[테스트 실행 성공] 결과:', finalResult);

        // 결과 모달 표시
        if (finalResult) {
          setExecutionResult(finalResult);
          setShowResultModal(true);
        }
      } catch (error) {
        const errorContent =
          error instanceof Error
            ? `워크플로우 실행 실패: ${error.message}`
            : '워크플로우 실행 중 알 수 없는 오류가 발생했습니다.';
        console.error('[테스트 실행 실패]', error);
        setErrorMsg(errorContent);
      } finally {
        setIsExecuting(false);
      }
    },
    [workflowId, nodes],
  );

  // [NEW] Remote Run Trigger Effect
  const lastRunTriggerRef = useRef(0);
  useEffect(() => {
    if (runTrigger > lastRunTriggerRef.current) {
      handleTestRun();
      lastRunTriggerRef.current = runTrigger;
    }
  }, [runTrigger, handleTestRun]);

  return (
    <div>
      <div className="absolute top-20 right-6 z-50 flex items-center gap-2 pointer-events-auto">
        {/* 1. 로그 버튼 */}
        <button
          onClick={() => setIsLogViewerOpen(true)}
          className="px-4 py-2 flex items-center gap-2 text-gray-600 bg-white hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 shadow-sm text-sm font-medium"
        >
          <ScrollText className="w-4 h-4" />
          <span>로그</span>
        </button>

        {/* 2. 모니터링 버튼 */}
        <button
          onClick={() => setIsMonitoringOpen(true)}
          className="px-4 py-2 flex items-center gap-2 text-gray-600 bg-white hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 shadow-sm text-sm font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          <span>모니터링</span>
        </button>

        {/* 3. 기억 모드 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
          <MemoryModeToggle
            isEnabled={isMemoryModeEnabled}
            hasProviderKey={hasProviderKey}
            description={memoryModeDescription}
            onToggle={toggleMemoryMode}
          />
        </div>

        {/* 4. 테스트(미리보기) 버튼 - 파란색 스타일 */}
        <button
          onClick={handleTestRun}
          disabled={isExecuting}
          className={`px-4 py-2 flex items-center gap-2 rounded-lg transition-colors border shadow-sm ${
            isExecuting
              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <Play className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isExecuting ? '실행 중...' : '미리보기'}
          </span>
        </button>

        {/* 5. 게시하기 버튼 */}
        <div className="relative">
          <button
            onClick={() => setShowDeployDropdown(!showDeployDropdown)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            게시하기
            <svg
              className={`w-4 h-4 transition-transform ${showDeployDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDeployDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDeployDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 text-left">
                <button
                  onClick={() => {
                    setShowDeployDropdown(false);
                    handlePublishAsRestAPI();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    REST API로 배포
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    API 키로 접근
                  </div>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setShowDeployDropdown(false);
                    handlePublishAsWebApp();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    웹 앱으로 배포
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    링크 공유로 누구나 사용
                  </div>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setShowDeployDropdown(false);
                    handlePublishAsWidget();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    웹사이트에 챗봇 추가하기
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    복사 한 번으로 위젯 연동 완료
                  </div>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setShowDeployDropdown(false);
                    handlePublishAsWorkflowNode();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">
                    워크플로우 노드로 배포
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    다른 워크플로우에서 재사용
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 6. 버전 기록 (아이콘만) */}
        <button
          onClick={handleVersionHistory}
          className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 rounded-full shadow-sm transition-colors text-gray-600"
          title="버전 기록"
        >
          <ClockIcon className="w-5 h-5" />
        </button>

        {/* [NEW] 로그 뷰어 모달 렌더링 */}
        {workflowId && (
          <>
            <LogViewerModal
              isOpen={isLogViewerOpen}
              onClose={() => {
                setIsLogViewerOpen(false);
                setInitialLogRunId(null);
                setReturnToMonitoring(false);
              }}
              workflowId={workflowId as string}
              initialRunId={initialLogRunId}
              onBack={
                returnToMonitoring
                  ? () => {
                      setIsLogViewerOpen(false);
                      setInitialLogRunId(null);
                      setIsMonitoringOpen(true);
                      setReturnToMonitoring(false);
                    }
                  : undefined
              }
            />
            <MonitoringDashboardModal
              isOpen={isMonitoringOpen}
              onClose={() => setIsMonitoringOpen(false)}
              workflowId={workflowId as string}
              onNavigateToLog={(runId) => {
                setInitialLogRunId(runId);
                setIsMonitoringOpen(false);
                setIsLogViewerOpen(true);
                setReturnToMonitoring(true);
              }}
              initialScrollTop={monitoringScrollPos}
              onSaveScrollPos={setMonitoringScrollPos}
            />
          </>
        )}
      </div>

      <div>
        {/* 에러 메시지 배너 */}
        {errorMsg && (
          <div className="fixed top-16 right-4 z-60 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md max-w-sm animate-bounce">
            <strong className="font-bold mr-1">오류!</strong>
            <span className="block sm:inline text-sm">{errorMsg}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setErrorMsg(null)}
            >
              <span className="text-red-500 font-bold">×</span>
            </button>
          </div>
        )}
      </div>

      {/* Deployment Modal */}
      {showDeployModal && (
        <DeploymentModal
          onClose={() => setShowDeployModal(false)}
          onSubmit={
            deploymentType === 'api'
              ? handleDeploySubmit
              : deploymentType === 'webapp'
                ? handleDeployAsWebApp
                : deploymentType === 'widget'
                  ? handleDeployAsWidget
                  : handleDeployAsWorkflowNode
          }
          isDeploying={isDeploying}
        />
      )}

      {/* Deployment Result Modal (성공/실패) */}
      {deploymentResult && (
        <DeploymentResultModal
          result={deploymentResult}
          onClose={() => setDeploymentResult(null)}
        />
      )}

      {/* 사용자 입력 모달 (개발 중 테스트 용입니다. 최종 X) */}
      {showModal && (
        <UserInputModal
          variables={modalVariables}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* 실행 결과 모달 (개발 중 테스트 용입니다. 최종 X) */}
      {showResultModal && executionResult && (
        <ResultModal
          result={executionResult}
          onClose={() => setShowResultModal(false)}
        />
      )}

      {/* Version History Sidebar */}
      <VersionHistorySidebar />

      {/* Preview Mode Banner */}
      {previewingVersion && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-in slide-in-from-top fade-in duration-300">
          <div className="flex flex-col">
            <span className="text-xs text-blue-200 font-medium">
              현재 미리보기 중
            </span>
            <span className="font-bold text-sm">
              v{previewingVersion.version} -{' '}
              {previewingVersion.description || '제목 없음'}
            </span>
          </div>
          <div className="h-8 w-px bg-blue-400 mx-2" />
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestore}
              className="px-4 py-1.5 bg-white text-blue-600 rounded-full text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm"
            >
              이 버전으로 복원
            </button>
            <button
              onClick={exitPreview}
              className="px-3 py-1.5 text-blue-100 hover:text-white hover:bg-blue-500/50 rounded-full text-sm transition-colors"
            >
              종료
            </button>
          </div>
        </div>
      )}
      {memoryModeModals}
    </div>
  );
}
