'use client';

import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useEditorStore } from '@/store/editorStore';
import CustomNode from './nodes/CustomNode';
import NoteNode from './nodes/NoteNode';
import BottomPanel from './BottomPanel';
import WorkflowTabs from './WorkflowTabs';

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
  } = useEditorStore();

  const { fitView, setViewport, getViewport } = useReactFlow();

  const nodeTypes = useMemo(
    () => ({
      custom: CustomNode,
      note: NoteNode,
    }),
    [],
  );

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
      updateWorkflowViewport(activeWorkflowId, viewport);
    },
    [activeWorkflowId, updateWorkflowViewport],
  );

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
            className="!shadow-lg !border !border-gray-200 !rounded-lg"
            showInteractive={false}
          />
        </ReactFlow>

        {/* Floating Bottom Panel */}
        <BottomPanel onCenterNodes={centerNodes} />
      </div>
    </div>
  );
}
