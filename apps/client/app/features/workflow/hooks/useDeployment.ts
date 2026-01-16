import { useState, useCallback } from 'react';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import type { DeploymentResult } from '../components/deployment/types';

type DeploymentType = 'api' | 'webapp' | 'widget' | 'workflow_node';

interface UseDeploymentProps {
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  isVersionHistoryOpen: boolean;
  toggleVersionHistory: () => void;
  isTestPanelOpen: boolean;
  toggleTestPanel: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeType: (type: string | null) => void;
}

export function useDeployment({
  isSettingsOpen,
  toggleSettings,
  isVersionHistoryOpen,
  toggleVersionHistory,
  isTestPanelOpen,
  toggleTestPanel,
  setSelectedNodeId,
  setSelectedNodeType,
}: UseDeploymentProps) {
  const [showDeployFlowModal, setShowDeployFlowModal] = useState(false);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('api');

  const { workflows, activeWorkflowId } = useWorkflowStore();
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  // 배포 드롭다운 토글 시 다른 패널 닫기
  const toggleDeployDropdown = useCallback(() => {
    if (!showDeployDropdown) {
      // 열릴 때 다른거 다 닫기
      if (isSettingsOpen) toggleSettings();
      if (isVersionHistoryOpen) toggleVersionHistory();
      if (isTestPanelOpen) toggleTestPanel();
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    }
    setShowDeployDropdown((prev) => !prev);
  }, [
    showDeployDropdown,
    isSettingsOpen,
    toggleSettings,
    isVersionHistoryOpen,
    toggleVersionHistory,
    isTestPanelOpen,
    toggleTestPanel,
    setSelectedNodeId,
    setSelectedNodeType,
  ]);

  const handlePublishAsRestAPI = useCallback(() => {
    setDeploymentType('api');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWebApp = useCallback(() => {
    setDeploymentType('webapp');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWidget = useCallback(() => {
    setDeploymentType('widget');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWorkflowNode = useCallback(() => {
    setDeploymentType('workflow_node');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

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

        useWorkflowStore.getState().notifyDeploymentComplete();

        const result: DeploymentResult = {
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: response.auth_secret ?? null,
          version: response.version,
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        };

        if (deploymentType === 'webapp') {
          result.webAppUrl = `${window.location.origin}/shared/${response.url_slug}`;
        } else if (deploymentType === 'widget') {
          result.embedUrl = `${window.location.origin}/embed/chat/${response.url_slug}`;
        } else if (deploymentType === 'workflow_node') {
          result.isWorkflowNode = true;
          result.auth_secret = null;
        }

        return result;
      } catch (error: any) {
        return {
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        };
      }
    },
    [deploymentType, activeWorkflow?.appId],
  );

  return {
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
    handleDeploy,
  };
}
