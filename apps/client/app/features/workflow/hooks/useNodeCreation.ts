import { useCallback } from 'react';
import { useReactFlow, type Edge } from '@xyflow/react';
import type { AppNode } from '../types/Nodes';
import { getNodeDefinition } from '../config/nodeRegistry';
import {
  findFirstAvailableHandle,
  createNewCaseForConnection,
} from '../utils/conditionNodeHelpers';
import { arrangeConditionNodeChildren } from '../utils/arrangeConditionNodes';

interface UseNodeCreationProps {
  nodes: AppNode[];
  setNodes: (nodes: AppNode[]) => void;
  edges: Edge[];
  setEdges: (edges: Edge[]) => void;
  previewState: {
    nearestNode: AppNode | null;
    isRight: boolean;
    draggedNodePosition: { x: number; y: number } | null;
  };
  resetPreview: () => void;
  setSearchModalContext: (context: {
    isOpen: boolean;
    position?: { x: number; y: number };
  }) => void;
}

export function useNodeCreation({
  nodes,
  setNodes,
  edges,
  setEdges,
  previewState,
  resetPreview,
  setSearchModalContext,
}: UseNodeCreationProps) {
  const { screenToFlowPosition } = useReactFlow();

  // Handle node drop from library
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeDefId = event.dataTransfer.getData('application/reactflow');
      if (!nodeDefId) return;

      const nodeDef = getNodeDefinition(nodeDefId);
      if (!nodeDef) return;

      // Use preview position if available, otherwise use mouse position
      const position =
        previewState.draggedNodePosition ||
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

      // 워크플로우 노드(모듈)인 경우, 바로 추가하지 않고 검색 모달을 엽니다.
      if (nodeDef.type === 'workflowNode') {
        setSearchModalContext({ isOpen: true, position });
        return;
      }

      // Remove ghost node and create real node
      const filteredNodes = nodes.filter((n) => n.id !== 'GHOST');

      const newNode: AppNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type as any,
        data: nodeDef.defaultData() as any,
        position,
      };

      // Auto-connect if there's a nearest node
      let sourceHandle: string | undefined;
      let updatedConditionNode: AppNode | null = null;

      if (previewState.nearestNode) {
        // For condition nodes, use priority-based auto-connect
        if (
          previewState.isRight &&
          previewState.nearestNode.type === 'conditionNode'
        ) {
          const conditionNode = previewState.nearestNode;

          // Find first available handle in priority order
          let targetHandle = findFirstAvailableHandle(conditionNode, edges);

          // If all handles are connected, create new case
          if (targetHandle === null) {
            const result = createNewCaseForConnection(conditionNode);
            targetHandle = result.caseId;
            updatedConditionNode = result.updatedNode;
          }

          sourceHandle = targetHandle;
        }
      }

      // Update nodes: add new node and update condition node if needed
      let nodesToSet: AppNode[];
      if (updatedConditionNode) {
        const updatedNodes = filteredNodes.map((node) =>
          node.id === updatedConditionNode!.id ? updatedConditionNode! : node,
        );
        nodesToSet = [...updatedNodes, newNode];
      } else {
        nodesToSet = [...filteredNodes, newNode];
      }

      // If connected to a condition node, arrange all its children
      if (
        previewState.nearestNode &&
        previewState.nearestNode.type === 'conditionNode'
      ) {
        // Create temporary edges array to include the new edge
        const tempEdges = previewState.nearestNode
          ? [
              ...edges,
              {
                id: `temp-${Date.now()}`,
                source: previewState.isRight
                  ? previewState.nearestNode.id
                  : newNode.id,
                target: previewState.isRight
                  ? newNode.id
                  : previewState.nearestNode.id,
                sourceHandle: sourceHandle || undefined,
              },
            ]
          : edges;

        nodesToSet = arrangeConditionNodeChildren(
          updatedConditionNode || previewState.nearestNode,
          nodesToSet,
          tempEdges as Edge[],
        );
      }

      setNodes(nodesToSet);

      // Create edge if there's a nearest node
      if (previewState.nearestNode) {
        const newEdge = {
          id: `e-${Date.now()}`,
          source: previewState.isRight
            ? previewState.nearestNode.id
            : newNode.id,
          target: previewState.isRight
            ? newNode.id
            : previewState.nearestNode.id,
          sourceHandle: sourceHandle || undefined,
          type: 'puzzle',
        };

        setEdges([...edges, newEdge]);
      }

      // Clean up preview
      resetPreview();
    },
    [
      screenToFlowPosition,
      setNodes,
      nodes,
      resetPreview,
      previewState,
      setEdges,
      edges,
      setSearchModalContext,
    ],
  );

  // Add node from library (center of screen)
  const handleAddNodeFromLibrary = useCallback(
    (nodeDefId: string) => {
      const nodeDef = getNodeDefinition(nodeDefId);
      if (!nodeDef) return;

      const centerPos = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode: AppNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type as any,
        data: nodeDef.defaultData() as any,
        position: centerPos,
      };

      setNodes([...nodes, newNode]);
    },
    [screenToFlowPosition, setNodes, nodes],
  );

  return {
    onDrop,
    handleAddNodeFromLibrary,
  };
}
