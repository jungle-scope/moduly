import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { AppNode } from '../types/Nodes';

interface DragPreviewState {
  nearestNode: AppNode | null;
  draggedNodePosition: { x: number; y: number } | null;
  isRight: boolean; // Whether dragged node is to the right of nearest node
  highlightedHandle: string | null; // 🆕 Which handle is highlighted during drag
}

interface DragPreviewResult {
  previewState: DragPreviewState;
  onDragOver: (event: React.DragEvent) => void;
  resetPreview: () => void;
}

/**
 * Custom hook for managing drag-and-drop connection preview
 *
 * Calculates smart positioning for dragged node and shows connection preview
 */

/**
 * Calculate which handle will be used for connection (priority-based)
 * Priority: default -> case1 -> case2 -> ...
 * This matches the actual connection logic in onDrop
 */
function calculatePriorityHandle(
  conditionNode: AppNode,
  edges: any[], // Edge array to check existing connections
): string {
  const cases = (conditionNode.data as any).cases || [];

  // Priority 1: default (if not connected)
  const isDefaultConnected = edges.some(
    (edge: any) =>
      edge.source === conditionNode.id && edge.sourceHandle === 'default',
  );
  if (!isDefaultConnected) {
    return 'default';
  }

  // Priority 2+: cases in order (if not connected)
  for (const caseItem of cases) {
    const isCaseConnected = edges.some(
      (edge: any) =>
        edge.source === conditionNode.id && edge.sourceHandle === caseItem.id,
    );
    if (!isCaseConnected) {
      return caseItem.id;
    }
  }

  // All handles connected - will create new case
  // Highlight the position where new case will be created
  return `case-new-${cases.length + 1}`;
}

export function useDragConnectionPreview(
  nodes: AppNode[],
  edges: any[],
): DragPreviewResult {
  const { screenToFlowPosition } = useReactFlow();

  const [previewState, setPreviewState] = useState<DragPreviewState>({
    nearestNode: null,
    draggedNodePosition: null,
    isRight: false,
    highlightedHandle: null,
  });

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      // Check if dragging a node from library
      const isDraggingNode = event.dataTransfer.types.includes(
        'application/reactflow',
      );

      if (!isDraggingNode) {
        if (previewState.nearestNode || previewState.draggedNodePosition) {
          setPreviewState({
            nearestNode: null,
            draggedNodePosition: null,
            isRight: false,
            highlightedHandle: null,
          });
        }
        return;
      }

      const mousePosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Find nearest node for auto-connect
      const CONNECT_THRESHOLD = 500; // Increased for wider activation range
      let nearestNode: AppNode | null = null;
      let minDistance = CONNECT_THRESHOLD;

      nodes.forEach((node) => {
        if (node.type === 'note') return;

        const nodeCenter = {
          x: node.position.x + 150,
          y: node.position.y + 75,
        };

        const dx = nodeCenter.x - mousePosition.x;
        const dy = nodeCenter.y - mousePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearestNode = node;
        }
      });

      if (nearestNode) {
        // Determine if dragged node should be on right or left
        const isRight =
          mousePosition.x > (nearestNode as AppNode).position.x + 150;

        // 시작 노드(startNode, scheduleTrigger)의 왼쪽과 응답 노드(answerNode)의 오른쪽은 연결 불가
        const nodeType = (nearestNode as any).type as string;
        const isStartNode =
          nodeType === 'startNode' || nodeType === 'scheduleTrigger';
        const isAnswerNode = nodeType === 'answerNode';

        // 연결 불가능한 방향이면 미리보기 표시 안 함
        if ((isStartNode && !isRight) || (isAnswerNode && isRight)) {
          setPreviewState({
            nearestNode: null,
            draggedNodePosition: null,
            isRight: false,
            highlightedHandle: null,
          });
          return;
        }

        // Calculate smart position for dragged node
        // Account for node width (300px) to ensure proper spacing
        const NODE_WIDTH = 300;
        const SPACING = 100; // Gap between nodes (increased for wider spacing)

        const draggedNodePosition = {
          x: isRight
            ? (nearestNode as AppNode).position.x + NODE_WIDTH + SPACING // Right: after nearest node
            : (nearestNode as AppNode).position.x - NODE_WIDTH - SPACING, // Left: before nearest node
          y: (nearestNode as AppNode).position.y,
        };

        // Calculate highlighted handle for condition nodes (priority-based)
        let highlightedHandle: string | null = null;
        if (isRight && (nearestNode as any).type === 'conditionNode') {
          highlightedHandle = calculatePriorityHandle(
            nearestNode as AppNode,
            edges,
          );
        }

        // Set global for ConditionNode to access
        (window as any).__dragHighlightedHandle__ = highlightedHandle;

        setPreviewState({
          nearestNode,
          draggedNodePosition,
          isRight,
          highlightedHandle,
        });
      } else {
        // Clear global when no nearest node
        (window as any).__dragHighlightedHandle__ = null;

        setPreviewState({
          nearestNode: null,
          draggedNodePosition: null,
          isRight: false,
          highlightedHandle: null,
        });
      }
    },
    [nodes, screenToFlowPosition, previewState, edges],
  );

  const resetPreview = useCallback(() => {
    // Clear global state
    (window as any).__dragHighlightedHandle__ = null;

    setPreviewState({
      nearestNode: null,
      draggedNodePosition: null,
      isRight: false,
      highlightedHandle: null,
    });
  }, []);

  return {
    previewState,
    onDragOver,
    resetPreview,
  };
}
