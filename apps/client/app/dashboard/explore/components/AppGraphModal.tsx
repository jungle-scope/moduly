import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { App } from '@/app/features/app/api/appApi';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowInnerCanvas } from '@/app/features/workflow/components/nodes/workflow/components/WorkflowInnerCanvas';
import { Node, Edge } from '@xyflow/react';

interface AppGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: App;
}

export function AppGraphModal({ isOpen, onClose, app }: AppGraphModalProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && app) {
      const fetchGraph = async () => {
        setIsLoading(true);
        setError(null);
        setNodes([]);
        setEdges([]);

        try {
          let snapshot: any = null;

          if (app.active_deployment_id) {
            // 배포된 버전이 있으면 배포 스냅샷 사용
            const deployment = await workflowApi.getDeployment(
              app.active_deployment_id,
            );
            snapshot = deployment.graph_snapshot;
          } else if (app.workflow_id) {
            // 배포된 버전이 없으면 드래프트 워크플로우 시도 (권한에 따라 실패 가능)
            try {
              // Explore 페이지의 앱은 보통 다른 사람의 앱이므로 Draft 권한이 없을 수 있음.
              // 하지만 내가 만든 앱일 수도 있으므로 시도.
              // 실패시에는 view 가능한 방법이 제한적일 수 있음.
              const draft = await workflowApi.getDraftWorkflow(app.workflow_id);
              // Draft 응답 구조에 따라 노드/엣지 추출 (api.ts 확인 필요 - 보통 nodes, edges 바로 반환하거나 draft 객체 내부)
              // workflowApi.getDraftWorkflow returns response.data which is likely { nodes, edges, viewport, ... }
              snapshot = draft;
            } catch (err) {
              console.warn(
                'Failed to fetch draft workflow, might be unauthorized:',
                err,
              );
              throw new Error(
                '워크플로우 정보를 불러올 수 없습니다. (배포되지 않은 앱)',
              );
            }
          }

          if (snapshot && snapshot.nodes) {
            setNodes(snapshot.nodes);
            setEdges(snapshot.edges || []);
          } else {
            throw new Error('그래프 데이터가 없습니다.');
          }
        } catch (err: any) {
          console.error('Failed to load app graph:', err);
          setError(err.message || '그래프를 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchGraph();
    }
  }, [isOpen, app]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full h-full max-w-5xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden dark:bg-gray-900 dark:border dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800"
              style={{
                backgroundColor: app.icon?.background_color,
              }}
            >
              {app.icon?.content || '⚡️'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {app.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {app.description || '워크플로우 미리보기'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content (Canvas) */}
        <div className="flex-1 bg-gray-50 relative dark:bg-gray-950">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 dark:bg-gray-900/50">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
              <p className="font-medium">{error}</p>
              <button
                onClick={onClose}
                className="text-sm text-blue-500 hover:underline"
              >
                닫기
              </button>
            </div>
          ) : (
            <WorkflowInnerCanvas nodes={nodes} edges={edges} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-gray-100 text-xs text-gray-400 flex justify-between items-center dark:bg-gray-900 dark:border-gray-800">
          <span>Read-only View</span>
          <span>
            {nodes.length} nodes, {edges.length} edges
          </span>
        </div>
      </div>
    </div>
  );
}
