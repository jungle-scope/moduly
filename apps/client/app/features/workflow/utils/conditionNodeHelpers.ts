import type { AppNode } from '../types/Nodes';
import type { Edge } from '@xyflow/react';

/**
 * Check if a specific handle is already connected
 */
export function isHandleConnected(
  edges: Edge[],
  nodeId: string,
  handleId: string,
): boolean {
  return edges.some(
    (edge) => edge.source === nodeId && edge.sourceHandle === handleId,
  );
}

/**
 * Find the first available (unconnected) handle in priority order
 * Priority: default -> case1 -> case2 -> ...
 */
export function findFirstAvailableHandle(
  conditionNode: AppNode,
  edges: Edge[],
): string | null {
  const nodeId = conditionNode.id;
  const cases = (conditionNode.data as any).cases || [];

  // Priority 1: default
  if (!isHandleConnected(edges, nodeId, 'default')) {
    return 'default';
  }

  // Priority 2+: cases in order
  for (const caseItem of cases) {
    if (!isHandleConnected(edges, nodeId, caseItem.id)) {
      return caseItem.id;
    }
  }

  // All handles connected
  return null;
}

/**
 * Create a new case for the condition node
 * Returns the updated node and new case ID
 */
export function createNewCaseForConnection(conditionNode: AppNode): {
  updatedNode: AppNode;
  caseId: string;
} {
  const cases = (conditionNode.data as any).cases || [];
  const newCaseIndex = cases.length + 1;

  const newCase = {
    id: `case-${Date.now()}`,
    case_name: `Case ${newCaseIndex}`,
    conditions: [],
    logical_operator: 'and' as const,
  };

  const updatedNode: AppNode = {
    ...conditionNode,
    data: {
      ...conditionNode.data,
      cases: [...cases, newCase],
    },
  } as AppNode;

  return { updatedNode, caseId: newCase.id };
}
