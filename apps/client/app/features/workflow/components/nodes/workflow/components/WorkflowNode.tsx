import { memo, useState, useCallback, useMemo } from 'react';
import { WorkflowInnerCanvas } from './WorkflowInnerCanvas';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { WorkflowNode as WorkflowNodeType } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { workflowApi } from '../../../../api/workflowApi';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { toast } from 'sonner';

// **워크플로우 모듈 노드 컴포넌트**
// 다른 워크플로우(App)를 하나의 노드처럼 가져와서 실행할 수 있게 해줍니다.
// 가져온 앱의 아이콘과 이름을 표시합니다.
export const WorkflowNode = memo(
  ({ id, data, selected }: NodeProps<WorkflowNodeType>) => {
    const { updateNodeData } = useWorkflowStore();
    const [isLoading, setIsLoading] = useState(false);

    // BaseNode 헤더에 설명이 중복 표시되지 않도록 description을 제외하고 전달
    const baseNodeData = { ...data, description: undefined };

    const isExpanded = data.expanded || false;

    const handleToggle = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        // 1. 이미 펼쳐져 있으면 닫기
        if (isExpanded) {
          updateNodeData(id, { expanded: false });
          return;
        }

        // 2. 이미 데이터가 있으면 그냥 펼치기
        if (data.graph_snapshot) {
          updateNodeData(id, { expanded: true });
          return;
        }

        // 3. 데이터가 없고 deployment_id가 있으면 서버에서 가져오기
        if (data.deployment_id) {
          setIsLoading(true);
          try {
            const deployment = await workflowApi.getDeployment(
              data.deployment_id,
            );

            // 데이터 저장 및 펼치기
            updateNodeData(id, {
              expanded: true,
              graph_snapshot: deployment.graph_snapshot,
              version: deployment.version,
            });
          } catch {
            toast.error('워크플로우 정보를 가져오는데 실패했습니다.');
          } finally {
            setIsLoading(false);
          }
        } else {
          // deployment_id가 없는 경우 (구버전 데이터 등)
          toast.warning('세부 정보를 볼 수 없는 노드입니다.');
        }
      },
      [id, isExpanded, data.deployment_id, data.graph_snapshot, updateNodeData],
    );

    // 내부 노드 및 엣지 필터링 (실행 흐름에 연결된 것만)
    const { filteredNodes, filteredEdges, containerSize } = useMemo(() => {
      if (!data.graph_snapshot?.nodes)
        return {
          filteredNodes: [],
          filteredEdges: [],
          containerSize: { width: 600, height: 400 },
        };

      const nodes = data.graph_snapshot.nodes as any[];
      const edges = (data.graph_snapshot.edges || []) as any[];

      // 1. 시작 노드 찾기
      const startNode = nodes.find(
        (n) => n.type === 'start' || n.type === 'startNode',
      );

      if (!startNode) {
        return {
          filteredNodes: nodes.map((n) => ({
            ...n,
            draggable: false,
            selectable: false,
          })),
          filteredEdges: edges,
          containerSize: { width: 600, height: 400 },
        };
      }

      // 2. 그래프 순회 (BFS)
      const reachableNodeIds = new Set<string>();
      const queue = [startNode.id];
      reachableNodeIds.add(startNode.id);

      while (queue.length > 0) {
        const currentNodeId = queue.shift()!;
        const outgoingEdges = edges.filter((e) => e.source === currentNodeId);

        for (const edge of outgoingEdges) {
          const targetNodeId = edge.target;
          if (!reachableNodeIds.has(targetNodeId)) {
            reachableNodeIds.add(targetNodeId);
            queue.push(targetNodeId);
          }
        }
      }

      // 3. 필터링 및 Read-only 속성 주입
      const validNodes = nodes.filter((n) => reachableNodeIds.has(n.id));
      const validEdges = edges.filter(
        (e) => reachableNodeIds.has(e.source) && reachableNodeIds.has(e.target),
      );

      // 4. 그래프 크기 계산 (Dynamic Sizing)
      const bounds = validNodes.reduce(
        (
          acc: { minX: number; maxX: number; minY: number; maxY: number },
          node: any,
        ) => {
          const x = node.position.x;
          const y = node.position.y;
          // ReactFlow 노드의 대략적인 크기 (measured가 없으면 기본값 사용)
          const w =
            (node.measured?.width as number) || (node.width as number) || 300;
          const h =
            (node.measured?.height as number) || (node.height as number) || 150;

          return {
            minX: Math.min(acc.minX, x),
            maxX: Math.max(acc.maxX, x + w),
            minY: Math.min(acc.minY, y),
            maxY: Math.max(acc.maxY, y + h),
          };
        },
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
      );

      const PADDING = 50;
      const calcWidth =
        bounds.minX === Infinity
          ? 600
          : bounds.maxX - bounds.minX + PADDING * 2;
      const calcHeight =
        bounds.minY === Infinity
          ? 400
          : bounds.maxY - bounds.minY + PADDING * 2;

      // 최소 600x400 ~ 최대 1200x900 제한
      const containerWidth = Math.min(Math.max(calcWidth, 600), 1200);
      const containerHeight = Math.min(Math.max(calcHeight, 400), 900);

      return {
        filteredNodes: validNodes.map((n) => ({
          ...n,
          // 내부 캔버스용 강제 설정 (혹시 모를 오동작 방지)
          draggable: false,
          connectable: false,
          selectable: false,
        })),
        filteredEdges: validEdges.map((e) => ({
          ...e,
          focusable: false,
          selectable: false,
        })),
        containerSize: { width: containerWidth, height: containerHeight },
      };
    }, [data.graph_snapshot]);

    return (
      <BaseNode
        data={baseNodeData}
        selected={selected}
        className="border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 transition-all duration-300 relative"
        showSourceHandle={false}
        showTargetHandle={false}
      >
        {/* Custom Handles fixed to the header area */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !top-[24px]"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !top-[24px]"
        />

        <div className="flex flex-col w-full">
          {/* Header Content */}
          <div className="flex items-center gap-3 py-1 relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              {data.icon ? (
                <span className="text-xl">{data.icon}</span>
              ) : (
                <div className="h-full w-full rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600" />
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0 pr-6">
              <div className="flex items-center justify-between">
                {/* Version removed as requested */}
              </div>
              {/* Toggle Button: Absolute Top Right */}
              <button
                onClick={handleToggle}
                className="absolute top-0 right-0 p-1 rounded-md hover:bg-purple-100 dark:hover:bg-purple-800/30 text-purple-600 transition-colors"
                title={isExpanded ? '접기' : '펼치기'}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <span
                className="text-xs text-muted-foreground truncate"
                title={data.description}
              >
                {data.description || '설명 없음'}
              </span>
            </div>
          </div>

          {/* Expanded Content: Visual Graph */}
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/30 animate-in slide-in-from-top-1 fade-in duration-200">
              <div
                className="nodrag bg-gray-100/50 rounded-lg overflow-hidden relative border border-gray-200"
                style={{
                  width: containerSize.width,
                  height: containerSize.height,
                }}
                onMouseDown={(e) => e.stopPropagation()} // 이벤트 전파 방지
                onClick={(e) => e.stopPropagation()}
              >
                {filteredNodes.length > 0 ? (
                  <WorkflowInnerCanvas
                    nodes={filteredNodes}
                    edges={filteredEdges}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    표시할 노드가 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </BaseNode>
    );
  },
);

WorkflowNode.displayName = 'WorkflowNode';
