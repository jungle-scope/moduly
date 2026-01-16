import dagre from 'dagre';
import type { AppNode } from '../types/Nodes';
import type { Edge } from '@xyflow/react';

const NODE_WIDTH = 300;
const NODE_HEIGHT = 150;

/**
 * Calculate auto layout for workflow nodes using Dagre
 */
export function calculateAutoLayout(
  nodes: AppNode[],
  edges: Edge[],
): AppNode[] {
  // 1. 노드 초기화 및 DAGRE 그래프 생성
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 간격을 넓혀서 엣지가 더 잘 보이도록 설정
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 80 });

  // 2. 연결된 노드와 고립된 노드 분류
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const connectedNodes: AppNode[] = [];
  nodes.forEach((node) => {
    if (node.type === 'note') return;

    if (connectedNodeIds.has(node.id)) {
      connectedNodes.push(node);

      let width = NODE_WIDTH;
      let height = NODE_HEIGHT;

      // 서브모듈 노드가 펼쳐져 있는 경우 동적 크기 계산
      if (
        node.type === 'workflowNode' &&
        (node.data as any).expanded &&
        (node.data as any).graph_snapshot
      ) {
        try {
          const snapshot = (node.data as any).graph_snapshot;
          const subNodes = (snapshot.nodes as any[]) || [];
          const subEdges = (snapshot.edges as any[]) || [];

          // 시작 노드 찾기
          const startNode = subNodes.find(
            (n) => n.type === 'start' || n.type === 'startNode',
          );

          let validNodes = subNodes;

          // 시작 노드가 있으면 도달 가능한 노드만 필터링
          if (startNode) {
            const reachableIds = new Set<string>([startNode.id]);
            const queue = [startNode.id];

            while (queue.length > 0) {
              const curr = queue.shift()!;
              const outgoing = subEdges.filter((e) => e.source === curr);
              for (const e of outgoing) {
                if (!reachableIds.has(e.target)) {
                  reachableIds.add(e.target);
                  queue.push(e.target);
                }
              }
            }
            validNodes = subNodes.filter((n) => reachableIds.has(n.id));
          }

          if (validNodes.length > 0) {
            const bounds = validNodes.reduce(
              (acc, n) => {
                const x = n.position.x;
                const y = n.position.y;
                const w =
                  (n.measured?.width as number) || (n.width as number) || 300;
                const h =
                  (n.measured?.height as number) || (n.height as number) || 150;
                return {
                  minX: Math.min(acc.minX, x),
                  maxX: Math.max(acc.maxX, x + w),
                  minY: Math.min(acc.minY, y),
                  maxY: Math.max(acc.maxY, y + h),
                };
              },
              {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity,
              },
            );

            const PADDING = 60;
            let calcWidth =
              bounds.minX === Infinity
                ? 600
                : bounds.maxX - bounds.minX + PADDING * 2;

            // 최소 너비 보정
            const minWidthByCount = validNodes.length * 100;
            calcWidth = Math.max(calcWidth, minWidthByCount);

            const calcHeight =
              bounds.minY === Infinity
                ? 300
                : bounds.maxY - bounds.minY + PADDING * 2;

            // 제한 적용
            const containerWidth = Math.min(Math.max(calcWidth, 600), 1800);
            const containerHeight = Math.min(Math.max(calcHeight, 300), 1200);

            // 80% 축소 적용
            width = Math.round(containerWidth * 0.8);
            height = containerHeight;
          }
        } catch {
          // Failed to calculate submodule size for layout
        }
      }

      dagreGraph.setNode(node.id, { width, height });
    }
  });

  edges.forEach((edge) => {
    if (
      connectedNodeIds.has(edge.source) &&
      connectedNodeIds.has(edge.target)
    ) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // 3. Dagre 레이아웃 계산 (연결된 노드)
  dagre.layout(dagreGraph);

  // 4. 새 위치 적용 및 고립된 노드 배치 준비
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;

  const layoutedNodes = nodes.map((node) => {
    if (node.type === 'note') return node;

    if (connectedNodeIds.has(node.id)) {
      const nodeWithPosition = dagreGraph.node(node.id);
      const x = nodeWithPosition.x - nodeWithPosition.width / 2;
      const y = nodeWithPosition.y - nodeWithPosition.height / 2;

      // Bounding Box 계산
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + nodeWithPosition.width);
      if (y + nodeWithPosition.height > maxY) {
        maxY = y + nodeWithPosition.height;
      }

      return {
        ...node,
        position: { x, y },
      };
    }
    return node;
  });

  // 만약 연결된 노드가 하나도 없으면 기본값 설정
  if (minX === Infinity) minX = 0;
  if (maxX === -Infinity) maxX = 1000; // 기본 너비

  // 고립된 노드(Orphan Nodes) 그리드 배치
  const orphanStartY = maxY + 150; // 연결된 그래프와 충분한 간격
  let currentX = minX;
  let currentY = orphanStartY;
  const gapX = 50;
  const gapY = 50;

  // 연결된 그래프의 너비를 기준으로 줄바꿈 (최소 1000px 보장)
  const maxWidth = Math.max(maxX - minX, 1000);

  const finalNodes = layoutedNodes.map((node) => {
    if (connectedNodeIds.has(node.id) || node.type === 'note') return node;

    // 위치 할당
    const newNode = {
      ...node,
      position: { x: currentX, y: currentY },
    };

    // 다음 위치 계산
    currentX += NODE_WIDTH + gapX;

    // 줄바꿈 체크 (시작점으로부터의 거리가 최대 너비를 넘으면)
    if (currentX - minX > maxWidth) {
      currentX = minX;
      currentY += NODE_HEIGHT + gapY;
    }

    return newNode;
  });

  return finalNodes;
}
