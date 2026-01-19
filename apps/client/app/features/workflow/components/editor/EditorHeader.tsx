'use client';

import { ChevronRight, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { ClockIcon } from '@/app/features/workflow/components/nodes/icons'; // Ensure this path is correct or use standard icon if custom is not reachable
import { MemoryModeToggle, useMemoryMode } from './memory/MemoryModeControls';
import { toast } from 'sonner';
import { useDeployment } from '../../hooks/useDeployment';
import { useMemo } from 'react';
import { DeploymentFlowModal } from '../deployment/DeploymentFlowModal';

export default function EditorHeader() {
  const router = useRouter();
  const {
    projectApp,
    nodes,
    isSettingsOpen,
    toggleSettings,
    isVersionHistoryOpen,
    toggleVersionHistory,
    isTestPanelOpen,
    toggleTestPanel,
    isMemoryModeEnabled, // This might need check if it's in store. If not, rely on hook.
  } = useWorkflowStore();

  // Assuming Memory Mode state is managed by hook if not in store effectively:
  // (In NodeCanvas it used useMemoryMode hook which handles its own state or system state)
  const {
    isMemoryModeEnabled: memEnabled,
    hasProviderKey,
    memoryModeDescription,
    toggleMemoryMode,
    modals: memoryModeModals,
  } = useMemoryMode(router, toast);

  // Publish state
  const canPublish = useWorkflowStore((state) => state.canPublish());

  // Deployment Hook
  const {
    showDeployFlowModal,
    setShowDeployFlowModal,
    showDeployDropdown,
    setShowDeployDropdown,
    deploymentType,
    toggleDeployDropdown,
    handlePublishAsRestAPI,
    handlePublishAsWebApp,
    handlePublishAsWidget,
    handlePublishAsWorkflowNode,
    handlePublishAsSchedule,
    handlePublishAsWebhook,
    handleDeploy,
  } = useDeployment({
    nodes,
    isSettingsOpen,
    toggleSettings,
    isVersionHistoryOpen,
    toggleVersionHistory,
    isTestPanelOpen,
    toggleTestPanel,
    setSelectedNodeId: () => {}, // Not needed for header actions mostly
    setSelectedNodeType: () => {},
  });

  // Start node detection for deployment options
  const startNode = useMemo(() => {
    return nodes.find(
      (n) =>
        n.type === 'startNode' ||
        n.type === 'webhookTrigger' ||
        n.type === 'scheduleTrigger',
    );
  }, [nodes]);

  return (
    <header className="h-14 min-h-[56px] bg-gradient-to-r from-blue-50 via-white to-blue-50/30 flex items-center px-4 pt-1 justify-between relative z-50">
      {/* 1. Left: Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm ml-2">
        <button
          onClick={() => router.push('/dashboard/mymodule')}
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          내 모듈
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">
          {projectApp?.name || '이름 없는 모듈'}
        </span>
      </nav>

      {/* 2. Right: Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Group: Memory | Settings | Version */}
        <div className="h-9 flex items-center p-0.5 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="h-full flex items-center px-2">
            <MemoryModeToggle
              isEnabled={memEnabled}
              hasProviderKey={hasProviderKey}
              description={memoryModeDescription}
              onToggle={toggleMemoryMode}
            />
          </div>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={toggleSettings}
            className="h-full px-3 flex items-center gap-1.5 rounded-md transition-colors hover:bg-gray-100 text-gray-600 text-[13px] font-medium"
          >
            <Settings className="w-4 h-4" />
            <span>설정</span>
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={toggleVersionHistory}
            className="h-full px-3 flex items-center gap-1.5 rounded-md transition-colors hover:bg-gray-100 text-gray-600 text-[13px] font-medium"
          >
            <ClockIcon className="w-4 h-4" />
            <span>버전</span>
          </button>
        </div>

        {/* Standalone: Publish Button & Dropdown */}
        <div className="relative">
          <button
            disabled={!canPublish}
            onClick={toggleDeployDropdown}
            className={`h-9 px-4 font-medium rounded-lg transition-colors flex items-center gap-1.5 text-[13px] shadow-sm ${
              !canPublish
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            게시하기
            <svg
              className={`w-3.5 h-3.5 transition-transform ${
                showDeployDropdown ? 'rotate-180' : ''
              }`}
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

          {/* Deployment Dropdown Menu */}
          {showDeployDropdown && canPublish && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDeployDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 text-left">
                {/* Webhook Trigger Deployment */}
                {startNode?.type === 'webhookTrigger' && (
                  <button
                    onClick={handlePublishAsWebhook}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      웹훅으로 개시하기
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      URL 호출로 실행
                    </div>
                  </button>
                )}

                {/* Schedule Trigger Deployment */}
                {startNode?.type === 'scheduleTrigger' && (
                  <button
                    onClick={handlePublishAsSchedule}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      알람으로 개시하기
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      설정된 주기에 따라 실행
                    </div>
                  </button>
                )}

                {/* Standard Start Node Deployment Options */}
                {(startNode?.type === 'startNode' || !startNode) && (
                  <>
                    <button
                      onClick={handlePublishAsRestAPI}
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
                      onClick={handlePublishAsWebApp}
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
                      onClick={handlePublishAsWidget}
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
                      onClick={handlePublishAsWorkflowNode}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        서브 모듈로 배포
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        다른 워크플로우에서 재사용
                      </div>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Deployment Flow Modal */}
      <DeploymentFlowModal
        isOpen={showDeployFlowModal}
        onClose={() => setShowDeployFlowModal(false)}
        deploymentType={deploymentType}
        onDeploy={handleDeploy}
      />

      {/* Memory Mode Modals */}
      {memoryModeModals}
    </header>
  );
}
