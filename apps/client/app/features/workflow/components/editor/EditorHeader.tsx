'use client';

import { useCallback, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  ClockIcon,
} from '@/app/features/workflow/components/icons';
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
    }
  | { success: false; message: string }
  | null;

export default function EditorHeader() {
  const router = useRouter();
  const params = useParams();
  const workflowId = (params.id as string) || 'default'; // URL에서 ID 파싱
  const { projectName, projectIcon, nodes } = useWorkflowStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

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
  const [deploymentType, setDeploymentType] = useState<'api' | 'webapp'>('api'); // 배포 타입 추적

  const handleBack = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleVersionHistory = useCallback(() => {
    // TODO: Implement version history
  }, []);

  const handlePublish = useCallback(() => {
    setDeploymentType('api'); // REST API 배포
    setShowDeployModal(true);
  }, []);

  const handlePublishAsWebApp = useCallback(() => {
    setDeploymentType('webapp'); // 웹 앱 배포
    setShowDeployModal(true);
  }, []);

  // rest API로 배포
  const handleDeploySubmit = useCallback(
    async (description: string) => {
      try {
        setIsDeploying(true);
        const response = await workflowApi.createDeployment({
          workflow_id: workflowId,
          description,
          type: 'api', // 현재는 API 타입만 지원
          is_active: true,
        });
        console.log('[배포 성공] 서버 응답:', response);

        // 성공 결과 모달 표시
        setDeploymentResult({
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: response.auth_secret ?? null,
          version: response.version,
        });
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
    [workflowId],
  );

  // 웹 앱으로 배포
  const handleDeployAsWebApp = useCallback(
    async (description: string) => {
      try {
        setIsDeploying(true);

        const response = await workflowApi.createDeployment({
          workflow_id: workflowId,
          description,
          type: 'webapp', // 웹 앱 배포
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
        });
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
    [workflowId],
  );

  const handleTestRun = useCallback(async () => {
    setErrorMsg(null);

    // 1. StartNode 찾기
    const startNode = nodes.find((node) => node.type === 'startNode');
    if (!startNode) {
      const errorContent =
        '시작 노드를 찾을 수 없습니다. 워크플로우에 시작 노드를 추가해주세요.';
      console.warn('start node가 없습니다.');
      setErrorMsg(errorContent);
      return;
    }

    // 2. 유효성 검사
    const data = startNode.data as StartNodeData;
    const variables = data.variables || [];
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
        const errorContent = `유효성 검사 실패: [${variable.label || variable.name}] ${error}`;
        console.warn(errorContent);
        setErrorMsg(errorContent);
        return;
      }
    }

    // 3. 변수 저장 후 모달 표시
    setModalVariables(variables);
    setShowModal(true);
  }, [nodes]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleModalSubmit = useCallback(
    async (inputs: Record<string, any>) => {
      setShowModal(false);

      // 워크플로우 실행
      try {
        setIsExecuting(true);
        console.log('[사용자 입력]', inputs);
        const result = await workflowApi.executeWorkflow(workflowId, inputs);
        console.log('[테스트 실행 성공] 결과:', result);

        // 결과 모달 표시
        setExecutionResult(result);
        setShowResultModal(true);
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
    [workflowId],
  );

  return (
    <div>
      <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 text-lg rounded-lg bg-gradient-to-br from-orange-400 to-pink-500">
              {projectIcon}
            </div>
            <h1 className="text-lg font-semibold text-gray-800">
              {projectName}
            </h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestRun}
            disabled={isExecuting}
            className={`px-4 py-2 font-medium rounded-lg transition-colors shadow-sm ${
              isExecuting
                ? 'bg-green-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isExecuting ? '실행 중...' : 'TEST'}
          </button>
          <button
            onClick={handleVersionHistory}
            className="px-4 py-2 flex items-center gap-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ClockIcon className="w-5 h-5" />
            <span className="text-sm font-medium">버전 기록</span>
          </button>

          {/* Publish Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDeployDropdown(!showDeployDropdown)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
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
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDeployDropdown(false)}
                />

                {/* Dropdown Content */}
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <button
                    onClick={() => {
                      setShowDeployDropdown(false);
                      handlePublish();
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
                </div>
              </>
            )}
          </div>
        </div>
      </header>

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
            deploymentType === 'api' ? handleDeploySubmit : handleDeployAsWebApp
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
    </div>
  );
}
