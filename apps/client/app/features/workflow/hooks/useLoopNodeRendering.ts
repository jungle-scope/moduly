import { useMemo } from 'react';
import type { AppNode } from '../types/Nodes';

/**
 * Loop 노드의 자식 노드들을 메인 캔버스에서 렌더링하기 위한 훅
 * NodeCanvas의 복잡도를 줄이기 위해 분리
 */
export function useLoopNodeRendering(nodes: AppNode[]) {
  /**
   * Loop 노드의 자식들을 포함한 전체 노드 배열 반환
   * 자식 노드들은 이미 parentNode 속성을 가지고 있어 React Flow가 자동으로 처리
   */
  const visibleNodes = useMemo(() => {
    // 모든 노드를 그대로 반환 (React Flow가 parentNode 기반으로 렌더링)
    return nodes;
  }, [nodes]);

  /**
   * Loop 노드 내부의 노드인지 확인
   */
  const isLoopChild = useMemo(() => {
    const loopChildIds = new Set(
      nodes.filter((n) => n.parentId).map((n) => n.id),
    );
    return (nodeId: string) => loopChildIds.has(nodeId);
  }, [nodes]);

  return {
    visibleNodes,
    isLoopChild,
  };
}
