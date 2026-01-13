'use client';

import { toast } from 'sonner';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ClockIcon } from '@/app/features/workflow/components/nodes/icons';

import { Play, ChevronLeft, Settings, Pencil } from 'lucide-react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

import { workflowApi } from '../../api/workflowApi';
import { SettingsSidebar } from './SettingsSidebar';
import { VersionHistorySidebar } from './VersionHistorySidebar';
import { TestSidebar } from './TestSidebar';
import { DeploymentFlowModal } from '../deployment/DeploymentFlowModal';
import type { DeploymentResult } from '../deployment/types';
import { MemoryModeToggle, useMemoryMode } from './memory/MemoryModeControls';
import { appApi } from '@/app/features/app/api/appApi';
import EditAppModal from '@/app/features/app/components/edit-app-modal';

export default function EditorHeader() {
  const router = useRouter();
  const params = useParams();
  const workflowId = (params.id as string) || 'default'; // URL에서 ID 파싱
  const {
    projectName,
    projectApp,
    setProjectApp,
    nodes,
    // 버전 기록 상태
    previewingVersion,
    exitPreview,
    restoreVersion,
    toggleVersionHistory,
    toggleSettings,
    toggleTestPanel,
    runTrigger,
  } = useWorkflowStore();
  const canPublish = useWorkflowStore((state) => state.canPublish());
  const startNodeType = useWorkflowStore((state) => state.getStartNodeType());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Store에서 workflows 가져오기 (appId 조회를 위해)
  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflow = workflows.find((w) => w.id === workflowId);

  // [NEW] 앱 수정 모달 상태
  const [showEditAppModal, setShowEditAppModal] = useState(false);

  // [NEW] 앱 정보 동기화 (activeWorkflow 변경 시)
  useEffect(() => {
    const fetchAppInfo = async () => {
      // 1. 이미 projectApp이 있고 ID가 일치하면 스킵
      if (projectApp && activeWorkflow?.appId === projectApp.id) return;

      // 2. activeWorkflow가 있고 appId가 있으면 로딩
      if (activeWorkflow?.appId) {
        try {
          const app = await appApi.getApp(activeWorkflow.appId);
          setProjectApp(app);
        } catch (error) {
          console.error('앱 정보 로딩 실패:', error);
        }
      }
    };
    fetchAppInfo();
  }, [activeWorkflow?.appId, projectApp, setProjectApp]);

  // [NEW] 앱 수정 성공 핸들러
  const handleAppUpdateSuccess = useCallback(async () => {
    if (activeWorkflow?.appId) {
      try {
        const updatedApp = await appApi.getApp(activeWorkflow.appId);
        setProjectApp(updatedApp);
      } catch (error) {
        console.error('앱 정보 갱신 실패:', error);
      }
    }
  }, [activeWorkflow?.appId, setProjectApp]);

  // ... existing state ...

  // 배포 상태
  const [showDeployFlowModal, setShowDeployFlowModal] = useState(false);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [deploymentType, setDeploymentType] = useState<
    'api' | 'webapp' | 'widget' | 'workflow_node' | 'schedule'
  >('api'); // 배포 타입 추적

  const {
    isMemoryModeEnabled,
    hasProviderKey,
    memoryModeDescription,
    toggleMemoryMode,
    modals: memoryModeModals,
  } = useMemoryMode(router, toast);

  const handleBack = useCallback(() => {
    router.push('/dashboard/mymodule');
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
    setDeploymentType('api');
    setShowDeployFlowModal(true);
  }, []);

  const handlePublishAsWebApp = useCallback(() => {
    setDeploymentType('webapp');
    setShowDeployFlowModal(true);
  }, []);

  const handlePublishAsWidget = useCallback(() => {
    setDeploymentType('widget');
    setShowDeployFlowModal(true);
  }, []);

  const handlePublishAsWorkflowNode = useCallback(() => {
    setDeploymentType('workflow_node');
    setShowDeployFlowModal(true);
  }, []);

  const handlePublishAsSchedule = useCallback(() => {
    setDeploymentType('schedule');
    setShowDeployFlowModal(true);
  }, []);

  // 통합 배포 핸들러
  const handleDeploy = useCallback(
    async (description: string): Promise<DeploymentResult> => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: deploymentType,
          is_active: true,
        });

        // 배포 성공 알림 (버전 기록 갱신용)
        useWorkflowStore.getState().notifyDeploymentComplete();

        // 배포 타입별로 다른 결과 반환
        const result: DeploymentResult = {
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: response.auth_secret ?? null,
          version: response.version,
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
          graph_snapshot: response.graph_snapshot ?? null,
        };

        // 배포 타입별 추가 정보
        if (deploymentType === 'webapp') {
          result.webAppUrl = `${window.location.origin}/shared/${response.url_slug}`;
        } else if (deploymentType === 'widget') {
          result.embedUrl = `${window.location.origin}/embed/chat/${response.url_slug}`;
        } else if (deploymentType === 'workflow_node') {
          result.isWorkflowNode = true;
          result.auth_secret = null; // 서브 모듈은 API 키 표시 안 함
        } else if (deploymentType === 'schedule') {
          // Schedule Trigger 노드에서 cron 정보 추출
          const scheduleNode = nodes.find((n) => n.type === 'scheduleTrigger');
          if (scheduleNode) {
            const data = scheduleNode.data as any;
            result.cronExpression = data.cron_expression || '0 9 * * *';
            result.timezone = data.timezone || 'Asia/Seoul';
          }
        }

        return result;
      } catch (error: any) {
        console.error(`[${deploymentType} 배포 실패]:`, error);

        return {
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        };
      }
    },
    [deploymentType, activeWorkflow?.appId, nodes],
  );

  const handleTestRun = useCallback(() => {
    toggleTestPanel();
  }, [toggleTestPanel]);

  // [NEW] 원격 실행 트리거 효과
  const lastRunTriggerRef = useRef(runTrigger);

  useEffect(() => {
    if (runTrigger > lastRunTriggerRef.current) {
      handleTestRun();
      lastRunTriggerRef.current = runTrigger;
    }
  }, [runTrigger, handleTestRun]);

  return (
    <header className="h-14 w-full bg-gradient-to-r from-blue-50 via-white to-blue-50/30 flex items-center justify-between px-4 z-50">
      {/* 1. Left Section */}
      <div className="flex items-center gap-3">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Project Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden"
          style={{
            backgroundColor: projectApp?.icon?.background_color || '#FEF3C7',
          }} // Default to amber-100 hex if missing
        >
          {projectApp?.icon?.content ? (
            projectApp.icon.type === 'image' ||
            projectApp.icon.content.startsWith('http') ? (
              <img
                src={projectApp.icon.content}
                alt="App Icon"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">{projectApp.icon.content}</span>
            )
          ) : (
            <div className="w-4 h-4 bg-amber-400 rounded-sm opacity-80" />
          )}
        </div>

        {/* Project Name & Edit */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">
            {projectName || '제목 없음'}
          </span>
          <button
            onClick={() => setShowEditAppModal(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={!projectApp} // 앱 정보가 로드되지 않았으면 비활성화
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* [NEW] 앱 수정 모달 */}
      {showEditAppModal && projectApp && (
        <EditAppModal
          app={projectApp}
          onClose={() => setShowEditAppModal(false)}
          onSuccess={handleAppUpdateSuccess}
        />
      )}

      {/* 2. Right Section */}
      <div className="flex items-center gap-3 relative">
        {/* Memory Mode */}
        {/* Wrapping in a div to match previous style or just button style */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg">
          <MemoryModeToggle
            isEnabled={isMemoryModeEnabled}
            hasProviderKey={hasProviderKey}
            description={memoryModeDescription}
            onToggle={toggleMemoryMode}
          />
        </div>

        {/* Version */}
        <button
          onClick={handleVersionHistory}
          className="px-3 py-1.5 flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors text-gray-600 text-[13px] font-medium"
        >
          <ClockIcon className="w-3.5 h-3.5" />
          <span>버전</span>
        </button>

        {/* Test (Preview) */}
        <button
          onClick={handleTestRun}
          className="px-3.5 py-1.5 flex items-center gap-1.5 rounded-lg transition-colors border bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span className="text-[13px] font-medium">테스트</span>
        </button>

        {/* Publish */}
        <div className="relative group">
          <button
            onClick={() =>
              canPublish && setShowDeployDropdown(!showDeployDropdown)
            }
            disabled={!canPublish}
            className={`px-3.5 py-1.5 font-medium rounded-lg transition-colors flex items-center gap-1.5 text-[13px] ${
              !canPublish
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            게시하기
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showDeployDropdown ? 'rotate-180' : ''}`}
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

          {/* Custom Tooltip for Disabled State */}
          {!canPublish && (
            <div className="invisible group-hover:visible absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 opacity-0 group-hover:opacity-100 transition-opacity">
              시작 노드가 정확히 1개 있어야 게시할 수 있습니다.
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 border-4 border-transparent border-b-gray-900"></div>
            </div>
          )}

          {/* Deploy Dropdown */}
          {showDeployDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDeployDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 text-left">
                {/* startNode: 모든 배포 옵션 표시 */}
                {startNodeType === 'startNode' && (
                  <>
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
                        서브 모듈로 배포
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        다른 모듈에서 재사용
                      </div>
                    </button>
                  </>
                )}

                {/* webhookTrigger: 웹훅 활성화만 표시 */}
                {startNodeType === 'webhookTrigger' && (
                  <button
                    onClick={() => {
                      setShowDeployDropdown(false);
                      handlePublishAsRestAPI(); // 웹훅도 REST API 배포 사용
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      웹훅 트리거 활성화
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      외부 서비스 트리거를 통해 모듈 실행
                    </div>
                  </button>
                )}

                {/* scheduleTrigger: 스케줄 활성화만 표시 */}
                {startNodeType === 'scheduleTrigger' && (
                  <button
                    onClick={() => {
                      setShowDeployDropdown(false);
                      handlePublishAsSchedule();
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      알람 트리거 활성화
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      정해진 시간에 자동 실행
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Settings (New) */}
        <button
          onClick={toggleSettings}
          className="px-3 py-1.5 flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors text-gray-600 text-[13px] font-medium"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>설정</span>
        </button>
      </div>

      {/* Global Modals & Overlays */}
      {/* 에러 메시지 배너 */}
      {errorMsg && (
        <div className="fixed top-16 right-4 z-[60] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md max-w-sm animate-bounce">
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

      {/* Deployment Flow Modal */}
      <DeploymentFlowModal
        isOpen={showDeployFlowModal}
        onClose={() => setShowDeployFlowModal(false)}
        deploymentType={deploymentType}
        onDeploy={handleDeploy}
      />

      {/* 버전 기록 사이드바 */}
      <VersionHistorySidebar />
      <SettingsSidebar />
      <TestSidebar />

      {/* 미리보기 모드 배너 */}
      {previewingVersion && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-in slide-in-from-top fade-in duration-300">
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
    </header>
  );
}
