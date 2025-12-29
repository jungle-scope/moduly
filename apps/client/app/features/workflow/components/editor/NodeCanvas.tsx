'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type NodeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { nodeTypes as coreNodeTypes } from '../nodes';
import NotePost from './NotePost';
import BottomPanel from './BottomPanel';
import WorkflowTabs from './WorkflowTabs';
import NodeDetailsPanel from './NodeDetailsPanel';
import { getNodeDefinitionByType } from '../../config/nodeRegistry';
import { StartNodePanel } from '../nodes/start/components/StartNodePanel';
import { AnswerNodePanel } from '../nodes/answer/components/AnswerNodePanel';
import { LLMNodePanel } from '../nodes/llm/components/LLMNodePanel';
import { TemplateNodePanel } from '../nodes/template/components/TemplateNodePanel';

export default function NodeCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    interactiveMode,
    workflows,
    activeWorkflowId,
    updateWorkflowViewport,
  } = useWorkflowStore();

  const { fitView, setViewport, getViewport } = useReactFlow();

  // Track selected node for details panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);

  const nodeTypes = useMemo(
    () => ({
      ...coreNodeTypes,
      note: NotePost,
    }),
    [],
  ) as unknown as NodeTypes;

  // Restore viewport when switching workflows
  useEffect(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    if (activeWorkflow?.viewport) {
      setViewport(activeWorkflow.viewport);
    }
  }, [activeWorkflowId, workflows, setViewport]);

  // Save viewport changes for the active workflow
  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      // Zustand에 저장 → useAutoSync가 자동으로 감지하여 서버에 저장
      updateWorkflowViewport(activeWorkflowId, viewport);
    },
    [activeWorkflowId, updateWorkflowViewport],
  );

  // Handle node click to show details panel
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Only show panel for workflow nodes (not notes)
    if (node.type && node.type !== 'note') {
      setSelectedNodeId(node.id);
      setSelectedNodeType(node.type);
    }
  }, []);

  // Close details panel
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
  }, []);

  // Get selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId);
  }, [selectedNodeId, nodes]);

  const panelHeader = useMemo(() => {
    if (!selectedNodeType) return undefined;
    const def = getNodeDefinitionByType(selectedNodeType);
    return {
      icon: def?.icon || '⬜️',
      title: def?.name || 'Node',
      description: def?.description,
    }; // NOTE: [LLM] 노드 정의 기반으로 패널 헤더 표시
  }, [selectedNodeType]);

  // Configure ReactFlow based on interactive mode
  const reactFlowConfig = useMemo(() => {
    if (interactiveMode === 'touchpad') {
      return {
        panOnDrag: [1, 2], // Pan with two fingers (middle and right mouse buttons simulate this)
        panOnScroll: true, // Enable scroll to pan
        zoomOnScroll: false, // Disable zoom on scroll
        zoomOnPinch: true, // Enable pinch to zoom
        selectionOnDrag: true, // Allow node selection and dragging with left click
      };
    } else {
      // Mouse-friendly mode
      return {
        panOnDrag: true, // Pan with left click drag
        panOnScroll: false, // Don't pan on scroll
        zoomOnScroll: true, // Zoom with scroll wheel
        zoomOnPinch: true, // Also support pinch
        selectionOnDrag: false,
      };
    }
  }, [interactiveMode]);

  const centerNodes = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
    // Save the new viewport after centering
    setTimeout(() => {
      const viewport = getViewport();
      updateWorkflowViewport(activeWorkflowId, viewport);
    }, 300);
  }, [fitView, getViewport, activeWorkflowId, updateWorkflowViewport]);

  return (
    <div className="flex-1 bg-gray-50 relative flex flex-col">
      {/* Workflow Tabs */}
      <WorkflowTabs />

      {/* ReactFlow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={handleMoveEnd}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          className="bg-gray-50"
          {...reactFlowConfig}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="#d1d5db"
          />
          <Controls
            className="shadow-lg! border! border-gray-200! rounded-lg!"
            showInteractive={false}
          />
        </ReactFlow>

        {/* Floating Bottom Panel - adjust position based on side panel */}
        <BottomPanel
          onCenterNodes={centerNodes}
          isPanelOpen={!!selectedNodeId}
        />

        {/* Node Details Panel - positioned relative to ReactFlow container */}
        <NodeDetailsPanel
          nodeId={selectedNodeId}
          onClose={handleClosePanel}
          header={panelHeader}
        >
          {selectedNode && selectedNodeType === 'startNode' && (
            <StartNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
          {selectedNode && selectedNodeType === 'answerNode' && (
            <AnswerNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
          {selectedNode && selectedNodeType === 'llmNode' && (
            <LLMNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
          {/* NOTE: [TemplateNode] TemplateNode 선택 시 패널 렌더링 추가 */}
          {selectedNode && selectedNodeType === 'templateNode' && (
            <TemplateNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
        </NodeDetailsPanel>
      </div>
    </div>
  );
}
