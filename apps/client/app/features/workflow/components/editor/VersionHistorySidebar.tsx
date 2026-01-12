import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { workflowApi } from '../../api/workflowApi';
import { DeploymentResponse } from '../../types/Deployment';
import { X, Clock, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

export function VersionHistorySidebar() {
  const {
    isVersionHistoryOpen,
    toggleVersionHistory,
    activeWorkflowId,
    previewVersion,
    previewingVersion,
    lastDeployedAt,
  } = useWorkflowStore();

  const [deployments, setDeployments] = useState<DeploymentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'toggle' | 'delete';
    deployment: DeploymentResponse;
  } | null>(null);

  // 버전 이력 가져오기
  const fetchHistory = async () => {
    if (!activeWorkflowId) return;
    try {
      setLoading(true);
      const data = await workflowApi.getDeployments(activeWorkflowId);
      const sorted = data.sort((a, b) => b.version - a.version);
      setDeployments(sorted);
    } catch (error) {
      console.error('Failed to fetch version history:', error);
      toast.error('버전 이력을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVersionHistoryOpen && activeWorkflowId) {
      fetchHistory();
    }
  }, [isVersionHistoryOpen, activeWorkflowId, lastDeployedAt]);

  const handleToggle = async (deployment: DeploymentResponse) => {
    try {
      await workflowApi.toggleDeployment(deployment.id);
      toast.success(
        deployment.is_active
          ? '배포가 비활성화되었습니다.'
          : '배포가 활성화되었습니다.',
      );
      fetchHistory();
    } catch (error: any) {
      console.error('Toggle failed:', error);
      toast.error(error.response?.data?.detail || '토글에 실패했습니다.');
    }
  };

  const handleDelete = async (deployment: DeploymentResponse) => {
    try {
      await workflowApi.deleteDeployment(deployment.id);
      toast.success('배포가 삭제되었습니다.');
      fetchHistory();
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  if (!isVersionHistoryOpen) return null;

  return (
    <>
      <div className="absolute top-24 right-0 bottom-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2 text-gray-800">
            <Clock className="w-5 h-5" />
            <h2 className="font-semibold">배포 버전 기록</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVersionHistory}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 현재 초안 표시기 */}
        <div className="p-4 bg-blue-50/50 border-b border-blue-100">
          <div
            className={`relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
              !previewingVersion
                ? 'border-blue-500 bg-white shadow-sm'
                : 'border-transparent hover:bg-blue-100/50'
            }`}
            onClick={() => useWorkflowStore.getState().exitPreview()}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  !previewingVersion
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-blue-300'
                }`}
              />
              {!previewingVersion && (
                <div className="w-0.5 h-full bg-blue-200 -mb-6" />
              )}
            </div>
            <div>
              <div className="font-semibold text-sm text-blue-900">
                현재 초안
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                편집 중인 상태입니다
              </div>
            </div>
            {!previewingVersion && (
              <div className="ml-auto text-blue-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* 버전 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              기록된 버전이 없습니다.
              <br />첫 배포를 진행해보세요!
            </div>
          ) : (
            <div className="relative">
              {/* 타임라인 선 */}
              <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-100 -z-10" />

              {deployments.map((v) => {
                const isSelected = previewingVersion?.id === v.id;

                return (
                  <div
                    key={v.id}
                    className={`group relative flex gap-4 p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 shadow-sm'
                        : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    {/* 삭제 버튼 (오른쪽 상단) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({ type: 'delete', deployment: v });
                      }}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors z-20"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    {/* 타임라인 점 */}
                    <div
                      className={`mt-1.5 w-3 h-3 rounded-full border-2 bg-white shrink-0 z-10 ${
                        isSelected
                          ? 'border-blue-500'
                          : 'border-gray-300 group-hover:border-gray-400'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div
                        className="cursor-pointer"
                        onClick={() => previewVersion(v)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                              v.type === 'api'
                                ? 'bg-blue-100 text-blue-700'
                                : v.type === 'webapp'
                                  ? 'bg-green-100 text-green-700'
                                  : v.type === 'widget'
                                    ? 'bg-purple-100 text-purple-700'
                                    : v.type === 'workflow_node'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {v.type === 'api'
                              ? 'API'
                              : v.type === 'webapp'
                                ? '웹앱'
                                : v.type === 'widget'
                                  ? '위젯'
                                  : v.type === 'workflow_node'
                                    ? '모듈'
                                    : 'MCP'}
                          </span>
                          <span
                            className={`font-medium text-base truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}
                          >
                            {v.description || '제목 없는 버전'}
                          </span>
                        </div>

                        <div className="text-sm text-gray-500 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span>v{v.version}</span>
                          </div>
                          <span>
                            {format(
                              new Date(v.created_at),
                              'yyyy-MM-dd HH:mm',
                              {
                                locale: ko,
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 토글 스위치 (오른쪽 하단) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({ type: 'toggle', deployment: v });
                      }}
                      className="absolute bottom-2 right-2 z-20"
                      title={v.is_active ? '비활성화' : '활성화'}
                    >
                      <div
                        className={`relative w-11 h-5 rounded-full transition-colors ${
                          v.is_active ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            v.is_active ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmModal.type === 'toggle'
                ? confirmModal.deployment.is_active
                  ? '배포 비활성화'
                  : '배포 활성화'
                : '배포 삭제'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmModal.type === 'toggle' ? (
                confirmModal.deployment.is_active ? (
                  <>
                    v{confirmModal.deployment.version} 배포를
                    비활성화하시겠습니까?
                    <br />
                    <br />
                    • 모든 실행 요청 차단
                    <br />• 스케줄 실행 중지
                  </>
                ) : (
                  <>
                    v{confirmModal.deployment.version} 배포를
                    활성화하시겠습니까?
                    <br />
                    <br />• 실행 요청 허용
                    <br />• 스케줄 재등록
                  </>
                )
              ) : (
                <>
                  v{confirmModal.deployment.version} 배포를 삭제하시겠습니까?
                  <br />
                  <br />
                  <span className="text-red-600 font-medium">
                    이 작업은 되돌릴 수 없습니다.
                  </span>
                  <br />
                  <br />• 배포 레코드 영구 삭제
                  <br />• 연결된 스케줄 Job 제거
                </>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (confirmModal.type === 'toggle') {
                    handleToggle(confirmModal.deployment);
                  } else {
                    handleDelete(confirmModal.deployment);
                  }
                  setConfirmModal(null);
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmModal.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmModal.deployment.is_active
                      ? 'bg-gray-600 hover:bg-gray-700'
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {confirmModal.type === 'toggle'
                  ? confirmModal.deployment.is_active
                    ? '비활성화'
                    : '활성화'
                  : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
