import type { AppNode } from '../types/Nodes';
import type { Edge } from '@xyflow/react';

const VERTICAL_SPACING = 250; // 노드 간 수직 간격
const HORIZONTAL_OFFSET = 500; // condition 노드로부터의 수평 거리

/**
 * Arrange nodes connected to a condition node in a vertical layout
 * @param conditionNode The condition node
 * @param nodes All nodes in the workflow
 * @param edges All edges in the workflow
 * @returns Updated nodes with arranged positions
 */
export function arrangeConditionNodeChildren(
  conditionNode: AppNode,
  nodes: AppNode[],
  edges: Edge[],
): AppNode[] {
  // Find all edges from the condition node with their source handles
  const connectedEdges = edges.filter(
    (edge) => edge.source === conditionNode.id,
  );

  if (connectedEdges.length === 0) {
    return nodes;
  }

  // Sort edges by case order: case1, case2, ..., default
  const sortedEdges = [...connectedEdges].sort((a, b) => {
    const handleA = a.sourceHandle || '';
    const handleB = b.sourceHandle || '';

    // Extract case numbers or identify default
    const getCaseOrder = (handle: string): number => {
      if (handle === 'default') return 9999; // default goes last
      const match = handle.match(/case(\d+)/);
      return match ? parseInt(match[1], 10) : 9998; // unknown cases go before default
    };

    return getCaseOrder(handleA) - getCaseOrder(handleB);
  });

  // Get condition node position
  const conditionPos = conditionNode.position;

  // Calculate starting Y position (centered around condition node)
  const totalHeight = (sortedEdges.length - 1) * VERTICAL_SPACING;
  const startY = conditionPos.y - totalHeight / 2;

  // Create a map of node positions based on sorted order
  const nodePositions = new Map<string, { x: number; y: number }>();
  sortedEdges.forEach((edge, index) => {
    nodePositions.set(edge.target, {
      x: conditionPos.x + HORIZONTAL_OFFSET,
      y: startY + index * VERTICAL_SPACING,
    });
  });

  // Update positions of connected nodes
  return nodes.map((node) => {
    const newPosition = nodePositions.get(node.id);
    if (!newPosition) {
      return node; // Not a connected node, keep original position
    }

    return {
      ...node,
      position: newPosition,
    };
  });
}
