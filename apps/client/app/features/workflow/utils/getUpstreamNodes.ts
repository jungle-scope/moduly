import { Edge } from '@xyflow/react';
import { Node } from '../types/Workflow';

/**
 * 주어진 노드의 업스트림(왼쪽에 연결된) 노드들을 찾습니다.
 * BFS를 사용하여 모든 업스트림 노드를 재귀적으로 탐색합니다.
 *
 * Loop Node 내부의 자식 노드인 경우:
 * - 부모 Loop Node를 포함
 * - 부모 Loop Node의 업스트림 노드들도 포함
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

  // 현재 노드 찾기
  const currentNode = nodes.find((n) => n.id === targetNodeId);

  // Loop Node 내부의 자식 노드인 경우, 부모 노드와 그 업스트림도 포함
  if (currentNode?.parentId) {
    const parentNode = nodes.find((n) => n.id === currentNode.parentId);
    if (parentNode) {
      // 부모 노드 추가
      upstreamNodeIds.add(parentNode.id);

      // 부모 노드의 업스트림 노드들도 재귀적으로 추가
      const parentUpstream = getUpstreamNodesInternal(
        parentNode.id,
        nodes,
        edges,
        visited,
      );
      parentUpstream.forEach((id) => upstreamNodeIds.add(id));
    }
  }

  // 일반적인 업스트림 노드 탐색
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

/**
 * 내부 헬퍼 함수: 업스트림 노드 ID들만 반환
 */
function getUpstreamNodesInternal(
  targetNodeId: string,
  nodes: Node[],
  edges: Edge[],
  visited: Set<string> = new Set(),
): Set<string> {
  const queue: string[] = [targetNodeId];
  const upstreamNodeIds = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const incomingEdges = edges.filter((e) => e.target === currentId);

    for (const edge of incomingEdges) {
      if (!visited.has(edge.source)) {
        upstreamNodeIds.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return upstreamNodeIds;
}
