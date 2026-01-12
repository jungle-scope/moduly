import { memo, useState, useCallback, useMemo } from 'react';
import { WorkflowInnerCanvas } from './WorkflowInnerCanvas';
import { NodeProps, useReactFlow, useNodes } from '@xyflow/react';
import { WorkflowNode as WorkflowNodeType } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { ChevronDown, ChevronRight, Loader2, Puzzle } from 'lucide-react';
import { workflowApi } from '../../../../api/workflowApi';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { toast } from 'sonner';

// **워크플로우 모듈 노드 컴포넌트**
// 다른 워크플로우(App)를 하나의 노드처럼 가져와서 실행할 수 있게 해줍니다.
// 가져온 앱의 아이콘과 이름을 표시합니다.
export const WorkflowNode = memo(
  ({ id, data, selected }: NodeProps<WorkflowNodeType>) => {
    const { updateNodeData } = useWorkflowStore();
    const { setEdges } = useReactFlow();
    const nodes = useNodes();
    const [isLoading, setIsLoading] = useState(false);

    const isExpanded = data.expanded || false;

    // 상태별 핸들 ID 생성
    const targetHandleId = isExpanded ? 'target-expanded' : 'target-collapsed';
    const sourceHandleId = isExpanded ? 'source-expanded' : 'source-collapsed';

    const handleToggle = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        // 현재 노드 찾기
        const currentNode = nodes.find((n) => n.id === id);
        if (!currentNode) return;

        const currentPosition = currentNode.position || { x: 0, y: 0 };
        const currentExpanded = (currentNode.data as any).expanded || false;

        // 1. 이미 펼쳐져 있으면 닫기
        if (currentExpanded) {
          // 현재 위치를 expandedPosition에 저장하고 닫기
          updateNodeData(id, {
            expanded: false,
            expandedPosition: currentPosition,
          });

          // 엣지 핸들 업데이트
          setEdges((eds) =>
            eds.map((edge) => {
              if (edge.source === id) {
                return { ...edge, sourceHandle: 'source-collapsed' };
              }
              if (edge.target === id) {
                return { ...edge, targetHandle: 'target-collapsed' };
              }
              return edge;
            }),
          );
          return;
        }

        // 2. 이미 데이터가 있으면 그냥 펼치기
        if (data.graph_snapshot) {
          // 현재 위치를 collapsedPosition에 저장하고 펼치기
          updateNodeData(id, {
            expanded: true,
            collapsedPosition: currentPosition,
          });

          // 엣지 핸들 업데이트
          setEdges((eds) =>
            eds.map((edge) => {
              if (edge.source === id) {
                return { ...edge, sourceHandle: 'source-expanded' };
              }
              if (edge.target === id) {
                return { ...edge, targetHandle: 'target-expanded' };
              }
              return edge;
            }),
          );
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
              collapsedPosition: currentPosition,
            });

            // 엣지 핸들 업데이트
            setEdges((eds) =>
              eds.map((edge) => {
                if (edge.source === id) {
                  return { ...edge, sourceHandle: 'source-expanded' };
                }
                if (edge.target === id) {
                  return { ...edge, targetHandle: 'target-expanded' };
                }
                return edge;
              }),
            );
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
      [id, data, updateNodeData, nodes, setEdges],
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

      let validNodes: any[] = [];
      let validEdges: any[] = [];

      if (startNode) {
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

        // 3. 필터링 (노드 중복 제거 및 엣지 중복 제거)
        const uniqueValidNodesMap = new Map();
        nodes.forEach((n) => {
          if (reachableNodeIds.has(n.id)) {
            uniqueValidNodesMap.set(n.id, n);
          }
        });
        validNodes = Array.from(uniqueValidNodesMap.values());

        const edgeKeys = new Set();
        validEdges = edges.filter((e) => {
          if (
            !uniqueValidNodesMap.has(e.source) ||
            !uniqueValidNodesMap.has(e.target)
          ) {
            return false;
          }
          const key = `${e.source}-${e.target}-${e.sourceHandle || ''}-${e.targetHandle || ''}`;
          if (edgeKeys.has(key)) {
            return false;
          }
          edgeKeys.add(key);
          return true;
        });
      } else {
        // Fallback: 시작 노드가 없으면 전체 노드 사용 (중복 제거)
        const uniqueNodesMap = new Map();
        nodes.forEach((n) => {
          uniqueNodesMap.set(n.id, n);
        });
        validNodes = Array.from(uniqueNodesMap.values());

        const edgeKeys = new Set();
        validEdges = edges.filter((e) => {
          const key = `${e.source}-${e.target}-${e.sourceHandle || ''}-${e.targetHandle || ''}`;
          if (edgeKeys.has(key)) return false;
          edgeKeys.add(key);
          return true;
        });
      }

      // 4. 그래프 크기 계산 (Dynamic Sizing)
      const bounds = validNodes.reduce(
        (
          acc: { minX: number; maxX: number; minY: number; maxY: number },
          node: any,
        ) => {
          const x = node.position.x;
          const y = node.position.y;
          // ReactFlow 노드의 대략적인 크기
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

      const PADDING = 60; // 패딩 확보 (컴팩트하게 조정)
      let calcWidth =
        bounds.minX === Infinity
          ? 600
          : bounds.maxX - bounds.minX + PADDING * 2;

      // [CRITICAL] 노드 개수에 따른 최소 너비 보정
      const minWidthByCount = validNodes.length * 100;
      calcWidth = Math.max(calcWidth, minWidthByCount);

      const calcHeight =
        bounds.minY === Infinity
          ? 300
          : bounds.maxY - bounds.minY + PADDING * 2;

      // 최소 600x300 ~ 최대 1800x1200 제한 (가로 축소)
      let containerWidth = Math.min(Math.max(calcWidth, 600), 1800);
      const containerHeight = Math.min(Math.max(calcHeight, 300), 1200);

      // 가로 길이만 80%로 축소
      containerWidth = Math.round(containerWidth * 0.8);

      return {
        filteredNodes: validNodes.map((n) => ({
          ...n,
          // 부모/그룹 관계 제거 (독립 렌더링)
          parentNode: undefined,
          extent: undefined,
          expandParent: undefined,

          draggable: false,
          connectable: false,
          selectable: false,
          style: { ...n.style, pointerEvents: 'none' as const },
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
        id={id}
        data={data}
        selected={selected}
        className="transition-all duration-300 relative"
        showSourceHandle={true}
        showTargetHandle={true}
        icon={<Puzzle className="text-white" />}
        iconColor="#14b8a6" // teal-500
        targetHandleId={targetHandleId}
        sourceHandleId={sourceHandleId}
        targetHandleStyle={
          isExpanded ? { top: '56px', left: '-12px' } : undefined
        }
        sourceHandleStyle={
          isExpanded ? { top: '56px', right: '-12px' } : undefined
        }
      >
        {/* 토글 버튼: 우측 상단 절대 위치 */}
        <button
          onClick={handleToggle}
          className="absolute top-5 right-5 p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
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

        {/* 확장된 콘텐츠: 시각적 그래프 */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-gray-100 animate-in slide-in-from-top-1 fade-in duration-200">
            <div
              className="nodrag bg-gray-50 rounded-lg overflow-hidden relative border border-gray-200"
              style={{
                width: containerSize.width,
                height: containerSize.height,
              }}
            >
              {filteredNodes.length > 0 ? (
                <WorkflowInnerCanvas
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  allowNavigation={true}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  표시할 노드가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </BaseNode>
    );
  },
);

WorkflowNode.displayName = 'WorkflowNode';
