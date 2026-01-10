'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Power, PowerOff } from 'lucide-react';
import { appApi, type Deployment } from '../api/appApi';

interface DeploymentListModalProps {
  appId: string;
  appName: string;
  onClose: () => void;
  onDeploymentToggle?: () => void;
}

const DEPLOYMENT_TYPE_LABELS: Record<string, string> = {
  api: 'REST API',
  webapp: '웹 앱',
  widget: '위젯',
  mcp: 'MCP',
  workflow_node: '서브 모듈',
};

export default function DeploymentListModal({
  appId,
  appName,
  onClose,
  onDeploymentToggle,
}: DeploymentListModalProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadDeployments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await appApi.getDeployments(appId);
      setDeployments(data);
    } catch (err) {
      setError('배포 목록을 불러오는데 실패했습니다.');
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadDeployments();
  }, [loadDeployments]);

  const handleToggle = async (deploymentId: string) => {
    try {
      setTogglingId(deploymentId);
      await appApi.toggleDeployment(deploymentId);
      await loadDeployments(); // 목록 새로고침
      onDeploymentToggle?.(); // 부모 컴포넌트에 알림
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('배포 토글 실패:', err);
      alert('배포 상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">배포 목록</h2>
            <p className="text-sm text-gray-500 mt-1">{appName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">로딩 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && deployments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">배포 이력이 없습니다.</p>
            </div>
          )}

          {!isLoading && !error && deployments.length > 0 && (
            <div className="space-y-3">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className={`border rounded-lg p-4 transition-all ${
                    deployment.is_active
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  } ${
                    deployment.type === 'workflow_node'
                      ? 'ring-2 ring-purple-200'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          버전 {deployment.version}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            deployment.type === 'workflow_node'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {DEPLOYMENT_TYPE_LABELS[deployment.type] ||
                            deployment.type}
                        </span>
                        {deployment.is_active && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            활성
                          </span>
                        )}
                      </div>
                      {deployment.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {deployment.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        생성일:{' '}
                        {new Date(deployment.created_at).toLocaleString(
                          'ko-KR',
                        )}
                      </p>
                    </div>

                    {/* 토글 버튼 */}
                    <button
                      onClick={() => handleToggle(deployment.id)}
                      disabled={togglingId === deployment.id}
                      className={`ml-4 p-2 rounded-md transition-colors ${
                        deployment.is_active
                          ? 'text-green-600 hover:bg-green-100'
                          : 'text-gray-400 hover:bg-gray-100'
                      } ${
                        togglingId === deployment.id
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                      title={
                        deployment.is_active ? '배포 비활성화' : '배포 활성화'
                      }
                    >
                      {deployment.is_active ? (
                        <Power className="w-5 h-5" />
                      ) : (
                        <PowerOff className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
