import { Edge } from '@xyflow/react';
import { Node } from '../types/Workflow';

/**
 * 주어진 노드의 업스트림(왼쪽에 연결된) 노드들을 찾습니다.
 * BFS를 사용하여 모든 업스트림 노드를 재귀적으로 탐색합니다.
 */
export function getUpstreamNodes(
  targetNodeId: string,
  nodes: Node[],
  edges: Edge[],
): Node[] {
  if (!nodes || !edges) return [];

  const visited = new Set<string>();
  const queue: string[] = [targetNodeId];
  const upstreamNodeIds = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // 현재 노드로 들어오는 엣지들 찾기
    const incomingEdges = edges.filter((e) => e.target === currentId);

    for (const edge of incomingEdges) {
      if (!visited.has(edge.source)) {
        upstreamNodeIds.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return nodes.filter((n) => upstreamNodeIds.has(n.id));
}
