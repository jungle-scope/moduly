import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { AppNode } from '../types/Nodes';

interface DragPreviewState {
  nearestNode: AppNode | null;
  draggedNodePosition: { x: number; y: number } | null;
  isRight: boolean; // Whether dragged node is to the right of nearest node
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
export function useDragConnectionPreview(nodes: AppNode[]): DragPreviewResult {
  const { screenToFlowPosition } = useReactFlow();

  const [previewState, setPreviewState] = useState<DragPreviewState>({
    nearestNode: null,
    draggedNodePosition: null,
    isRight: false,
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

        setPreviewState({
          nearestNode,
          draggedNodePosition,
          isRight,
        });
      } else {
        setPreviewState({
          nearestNode: null,
          draggedNodePosition: null,
          isRight: false,
        });
      }
    },
    [nodes, screenToFlowPosition, previewState],
  );

  const resetPreview = useCallback(() => {
    setPreviewState({
      nearestNode: null,
      draggedNodePosition: null,
      isRight: false,
    });
  }, []);

  return {
    previewState,
    onDragOver,
    resetPreview,
  };
}
