import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { AppNode, NoteNode } from '../types/Nodes';
import { getNodeDefinition } from '../config/nodeRegistry';

interface ContextMenu {
  x: number;
  y: number;
  isOpen: boolean;
}

interface NodeContextMenu {
  x: number;
  y: number;
  nodeId: string;
}

interface EdgeContextMenu {
  x: number;
  y: number;
  edgeId: string;
}

interface UseContextMenuProps {
  nodes: AppNode[];
  setNodes: (nodes: AppNode[]) => void;
  triggerWorkflowRun: () => void;
  setSearchModalContext: (context: {
    isOpen: boolean;
    position?: { x: number; y: number };
  }) => void;
}

export function useContextMenu({
  nodes,
  setNodes,
  triggerWorkflowRun,
  setSearchModalContext,
}: UseContextMenuProps) {
  const { screenToFlowPosition } = useReactFlow();

  // Context menu states
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [nodeContextMenu, setNodeContextMenu] =
    useState<NodeContextMenu | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] =
    useState<EdgeContextMenu | null>(null);
  const [isContextNodeSelectorOpen, setIsContextNodeSelectorOpen] =
    useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  // Pane context menu handler
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const x = event.clientX;
      const y = event.clientY;

      setContextMenu({ x, y, isOpen: true });
      setContextMenuPos({ x, y });
      setNodeContextMenu(null);
      setEdgeContextMenu(null);
    },
    [],
  );

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  }, []);

  // Add node from context menu
  const handleAddNodeFromContext = useCallback(() => {
    setContextMenu(null);
    setIsContextNodeSelectorOpen(true);
  }, []);

  // Add memo from context menu
  const handleAddMemoFromContext = useCallback(() => {
    if (!contextMenuPos) return;

    const position = screenToFlowPosition({
      x: contextMenuPos.x,
      y: contextMenuPos.y,
    });

    const newNote: NoteNode = {
      id: `note-${Date.now()}`,
      type: 'note',
      data: { content: '', title: '메모' },
      position,
      style: { width: 300, height: 100 },
    };

    setNodes([...nodes, newNote]);
    setContextMenu(null);
  }, [contextMenuPos, screenToFlowPosition, setNodes, nodes]);

  // Test run from context menu
  const handleTestRunFromContext = useCallback(() => {
    triggerWorkflowRun();
    setContextMenu(null);
  }, [triggerWorkflowRun]);

  // Select node from context menu
  const handleSelectNodeFromContext = useCallback(
    (nodeDefId: string) => {
      const nodeDef = getNodeDefinition(nodeDefId);
      if (!nodeDef) return;

      const position = screenToFlowPosition({
        x: contextMenuPos.x,
        y: contextMenuPos.y,
      });

      // 워크플로우 노드(모듈)인 경우, 바로 추가하지 않고 검색 모달을 엽니다.
      if (nodeDef.type === 'workflowNode') {
        setSearchModalContext({ isOpen: true, position });
        setIsContextNodeSelectorOpen(false);
        return;
      }

      const newNode: AppNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type as any,
        data: nodeDef.defaultData() as any,
        position,
      };

      setNodes([...nodes, newNode]);
      setIsContextNodeSelectorOpen(false);
    },
    [
      contextMenuPos,
      screenToFlowPosition,
      setNodes,
      nodes,
      setSearchModalContext,
    ],
  );

  return {
    // States
    contextMenu,
    nodeContextMenu,
    edgeContextMenu,
    isContextNodeSelectorOpen,
    contextMenuPos,
    // Setters
    setContextMenu,
    setNodeContextMenu,
    setEdgeContextMenu,
    setIsContextNodeSelectorOpen,
    // Handlers
    onPaneContextMenu,
    handleCloseContextMenu,
    handleAddNodeFromContext,
    handleAddMemoFromContext,
    handleTestRunFromContext,
    handleSelectNodeFromContext,
  };
}
