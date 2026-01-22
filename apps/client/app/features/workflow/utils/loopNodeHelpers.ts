import type { AppNode } from '../types/Nodes';
import type { Edge } from '@xyflow/react';

/**
 * Loop 노드의 자식 노드들을 가져옵니다.
 * @param loopNodeId Loop 노드의 ID
 * @param allNodes 전체 노드 배열
 * @returns Loop 노드의 자식 노드 배열
 */
export function getLoopNodeChildren(
  loopNodeId: string,
  allNodes: AppNode[],
): AppNode[] {
  return allNodes.filter((node) => node.parentId === loopNodeId);
}

/**
 * 노드가 Loop 노드 내부에 있는지 확인합니다.
 * @param node 확인할 노드
 * @returns Loop 노드 내부에 있으면 true
 */
export function isNodeInsideLoop(node: AppNode): boolean {
  return !!node.parentId;
}

/**
 * Loop 노드에 새 노드를 추가합니다.
 * @param loopNodeId Loop 노드의 ID
 * @param newNode 추가할 노드
 * @param nodes 현재 노드 배열
 * @returns 업데이트된 노드 배열
 */
export function addNodeToLoop(
  loopNodeId: string,
  newNode: AppNode,
  nodes: AppNode[],
): AppNode[] {
  // 새 노드에 parentNode 설정
  const nodeWithParent: AppNode = {
    ...newNode,
    parentId: loopNodeId,
    extent: 'parent' as const,
  };

  // Loop 노드의 _children 업데이트
  const updatedNodes = nodes.map((node) => {
    if (node.id === loopNodeId && node.type === 'loopNode') {
      const currentChildren = (node.data._children as string[]) || [];
      return {
        ...node,
        data: {
          ...node.data,
          _children: [...currentChildren, newNode.id],
        },
      };
    }
    return node;
  });

  return [...updatedNodes, nodeWithParent];
}

/**
 * Loop 노드에서 노드를 제거합니다.
 * @param nodeId 제거할 노드의 ID
 * @param nodes 현재 노드 배열
 * @param edges 현재 간선 배열
 * @returns 업데이트된 노드 및 간선 배열
 */
export function removeNodeFromLoop(
  nodeId: string,
  nodes: AppNode[],
  edges: Edge[],
): { nodes: AppNode[]; edges: Edge[] } {
  const nodeToRemove = nodes.find((n) => n.id === nodeId);
  if (!nodeToRemove || !nodeToRemove.parentId) {
    return { nodes, edges };
  }

  const parentId = nodeToRemove.parentId;

  // Loop 노드의 _children에서 제거
  const updatedNodes = nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.id === parentId && node.type === 'loopNode') {
        const currentChildren = (node.data._children as string[]) || [];
        return {
          ...node,
          data: {
            ...node.data,
            _children: currentChildren.filter((id) => id !== nodeId),
          },
        };
      }
      return node;
    });

  // 관련 간선 제거
  const updatedEdges = edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId,
  );

  return { nodes: updatedNodes, edges: updatedEdges };
}

/**
 * Loop 노드의 크기를 자식 노드들에 맞게 계산합니다.
 * @param loopNodeId Loop 노드의 ID
 * @param allNodes 전체 노드 배열
 * @returns 계산된 너비와 높이
 */
export function calculateLoopNodeSize(
  loopNodeId: string,
  allNodes: AppNode[],
): { width: number; height: number } {
  const children = getLoopNodeChildren(loopNodeId, allNodes);

  if (children.length === 0) {
    return { width: 300, height: 200 }; // 기본 크기
  }

  // 자식 노드들의 최대 범위 계산
  let maxX = 0;
  let maxY = 0;

  children.forEach((child) => {
    const childRight = child.position.x + (child.measured?.width || 300);
    const childBottom = child.position.y + (child.measured?.height || 150);

    if (childRight > maxX) maxX = childRight;
    if (childBottom > maxY) maxY = childBottom;
  });

  const padding = 100;
  return {
    width: Math.max(300, maxX + padding),
    height: Math.max(200, maxY + padding),
  };
}
