'use client';

import { Sliders, Plus, StickyNote, Play } from 'lucide-react';
import { NodeSelector } from './NodeSelector';
import NodeLibrarySidebar from './NodeLibrarySidebar';
import {
  type NodeDefinition,
  getNodeDefinition,
} from '../../config/nodeRegistry';
import { NoteNode, AppNode } from '../../types/Nodes';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { WorkflowNodeData, Node } from '../../types/Nodes';
import { nodeTypes as coreNodeTypes } from '../nodes';
import { PuzzleEdge } from '../nodes/edges/PuzzleEdge';
import NotePost from './NotePost';
import BottomPanel from './BottomPanel';
import NodeDetailsPanel from './NodeDetailsPanel';
import { getNodeDefinitionByType } from '../../config/nodeRegistry';
import { StartNodePanel } from '../nodes/start/components/StartNodePanel';
import { AnswerNodePanel } from '../nodes/answer/components/AnswerNodePanel';
import { HttpRequestNodePanel } from '../nodes/http/components/HttpRequestNodePanel';
import { SlackPostNodePanel } from '../nodes/slack/components/SlackPostNodePanel';
import { CodeNodePanel } from '../nodes/code/components/CodeNodePanel';
import { ConditionNodePanel } from '../nodes/condition/components/ConditionNodePanel';
import { LLMNodePanel } from '../nodes/llm/components/LLMNodePanel';
import { TemplateNodePanel } from '../nodes/template/components/TemplateNodePanel';
import { WorkflowNodePanel } from '../nodes/workflow/components/WorkflowNodePanel';
import { GithubNodePanel } from '../nodes/github/components/GithubNodePanel';
import { MailNodePanel } from '../nodes/mail/components/MailNodePanel';
import { AppSearchModal } from '../modals/AppSearchModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { App } from '@/app/features/app/api/appApi';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { FileExtractionNodePanel } from '../nodes/file_extraction/components/FileExtractionNodePanel';
import { WebhookTriggerNodePanel } from '../nodes/webhook/components/WebhookTriggerNodePanel';
import { LLMParameterSidePanel } from '../nodes/llm/components/LLMParameterSidePanel';
import { LLMReferenceSidePanel } from '../nodes/llm/components/LLMReferenceSidePanel';

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
    setNodes,
    updateNodeData,
    isVersionHistoryOpen,
    toggleVersionHistory,
    projectName,
    projectIcon,
    projectDescription,
    isFullscreen,
  } = useWorkflowStore();

  const { fitView, setViewport, getViewport, screenToFlowPosition } =
    useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isParamPanelOpen, setIsParamPanelOpen] = useState(false);
  const [isRefPanelOpen, setIsRefPanelOpen] = useState(false);
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(true);

  // 전체화면 모드 변경 시 사이드바 자동 토글
  useEffect(() => {
    if (isFullscreen) {
      setIsNodeLibraryOpen(false);
    } else {
      setIsNodeLibraryOpen(true);
    }
  }, [isFullscreen]);

  useKeyboardShortcut(
    ['Meta', 'k'],
    () => {
      setIsSearchModalOpen(true);
    },
    { preventDefault: true },
  );

  useEffect(() => {
    const handleOpenRefPanel = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId === selectedNodeId) {
        setIsRefPanelOpen((prev) => !prev);
        setIsParamPanelOpen(false);
      }
    };
    window.addEventListener('openLLMReferencePanel', handleOpenRefPanel);
    return () =>
      window.removeEventListener('openLLMReferencePanel', handleOpenRefPanel);
  }, [selectedNodeId]);

  const handleSelectApp = useCallback(
    async (app: App & { active_deployment_id?: string; version?: number }) => {
      const centerPos = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode: Node = {
        id: `workflow-${Date.now()}`,
        type: 'workflowNode',
        position: centerPos,
        data: {
          title: app.name,
          name: app.name,
          workflowId: app.workflow_id || '',
          appId: app.id,
          icon: app.icon?.content || '⚡️',
          description: app.description || '설명 없음',
          status: 'idle',
          version: app.version || 0,
          deployment_id: app.active_deployment_id,
          expanded: false,
          outputs: [],
        } as WorkflowNodeData,
      };

      setNodes([...nodes, newNode]);
      setIsSearchModalOpen(false);

      if (app.active_deployment_id) {
        try {
          const deployment = await workflowApi.getDeployment(
            app.active_deployment_id,
          );
          const outputKeys =
            deployment.output_schema?.outputs?.map(
              (o: { variable: string }) => o.variable,
            ) || [];
          updateNodeData(newNode.id, { outputs: outputKeys });
        } catch (err) {
          console.error('Failed to load workflow outputs:', err);
        }
      }
    },
    [nodes, setNodes, screenToFlowPosition, updateNodeData],
  );

  const nodeTypes = useMemo(
    () => ({
      ...coreNodeTypes,
      note: NotePost,
    }),
    [],
  ) as unknown as NodeTypes;

  const edgeTypes = useMemo(() => ({ puzzle: PuzzleEdge }), []);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'puzzle',
      style: { strokeWidth: 10, stroke: '#d1d5db' },
      animated: false,
    }),
    [],
  );

  const prevActiveWorkflowId = useRef(activeWorkflowId);

  useEffect(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

    if (prevActiveWorkflowId.current !== activeWorkflowId) {
      if (activeWorkflow?.viewport) {
        setViewport(activeWorkflow.viewport);
      }
      prevActiveWorkflowId.current = activeWorkflowId;
    }
  }, [activeWorkflowId, workflows, setViewport]);

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      updateWorkflowViewport(activeWorkflowId, viewport);
    },
    [activeWorkflowId, updateWorkflowViewport],
  );

  useEffect(() => {
    if (isVersionHistoryOpen) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
      setIsParamPanelOpen(false);
    }
  }, [isVersionHistoryOpen]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type && node.type !== 'note') {
        if (isVersionHistoryOpen) {
          toggleVersionHistory();
        }

        if (selectedNodeId !== node.id) {
          setIsParamPanelOpen(false);
          setIsRefPanelOpen(false);
        }
        setSelectedNodeId(node.id);
        setSelectedNodeType(node.type);
      }
    },
    [selectedNodeId, isVersionHistoryOpen, toggleVersionHistory],
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
    setIsParamPanelOpen(false);
    setIsRefPanelOpen(false);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId);
  }, [selectedNodeId, nodes]);

  const panelHeader = useMemo(() => {
    if (!selectedNodeType) return undefined;
    const def = getNodeDefinitionByType(selectedNodeType);
    if (selectedNodeType === 'workflowNode' && selectedNode) {
      return {
        icon: (selectedNode.data as unknown as WorkflowNodeData).icon || '🔄',
        title:
          (selectedNode.data as unknown as WorkflowNodeData).title ||
          'Workflow Module',
        description: 'Imported Workflow Module',
      };
    }

    return {
      icon: def?.icon || '⬜️',
      title: def?.name || 'Node',
      description: def?.description,
    };
  }, [selectedNodeType, selectedNode]);

  const reactFlowConfig = useMemo(() => {
    if (interactiveMode === 'touchpad') {
      return {
        panOnDrag: [1, 2],
        panOnScroll: true,
        zoomOnScroll: false,
        zoomOnPinch: true,
        selectionOnDrag: true,
      };
    } else {
      return {
        panOnDrag: true,
        panOnScroll: false,
        zoomOnScroll: true,
        zoomOnPinch: true,
        selectionOnDrag: false,
      };
    }
  }, [interactiveMode]);

  const centerNodes = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
    setTimeout(() => {
      const viewport = getViewport();
      updateWorkflowViewport(activeWorkflowId, viewport);
    }, 300);
  }, [fitView, getViewport, activeWorkflowId, updateWorkflowViewport]);

  const currentAppId = useMemo(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    return activeWorkflow?.appId;
  }, [workflows, activeWorkflowId]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  } | null>(null);

  const [isContextNodeSelectorOpen, setIsContextNodeSelectorOpen] =
    useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const x = event.clientX;
      const y = event.clientY;

      setContextMenu({ x, y, isOpen: true });
      setContextMenuPos({ x, y });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleAddNodeFromContext = useCallback(() => {
    setContextMenu(null);
    setIsContextNodeSelectorOpen(true);
  }, []);

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
      style: { width: 200, height: 100 },
    };

    setNodes([...nodes, newNote]);
    setContextMenu(null);
  }, [contextMenuPos, screenToFlowPosition, setNodes, nodes]);

  const { triggerWorkflowRun } = useWorkflowStore();

  const handleTestRunFromContext = useCallback(() => {
    triggerWorkflowRun();
    setContextMenu(null);
  }, [triggerWorkflowRun]);

  const handleSelectNodeFromContext = useCallback(
    (nodeDefId: string) => {
      const nodeDef = getNodeDefinition(nodeDefId);
      if (!nodeDef) return;

      const position = screenToFlowPosition({
        x: contextMenuPos.x,
        y: contextMenuPos.y,
      });

      const newNode: AppNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type as any,
        data: nodeDef.defaultData() as any,
        position,
      };

      setNodes([...nodes, newNode]);
      setIsContextNodeSelectorOpen(false);
    },
    [contextMenuPos, screenToFlowPosition, setNodes, nodes],
  );

  useEffect(() => {
    const handleClick = () => handleCloseContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [handleCloseContextMenu]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeDefId = event.dataTransfer.getData('application/reactflow');
      if (!nodeDefId) return;

      const nodeDef = getNodeDefinition(nodeDefId);
      if (!nodeDef) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AppNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type as any,
        data: nodeDef.defaultData() as any,
        position,
      };

      setNodes([...nodes, newNode]);
    },
    [screenToFlowPosition, setNodes, nodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

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

  return (
    <div className="flex-1 bg-gray-50 relative flex flex-row">
      {/* Node Library Sidebar */}
      <NodeLibrarySidebar
        isOpen={isNodeLibraryOpen}
        onToggle={() => setIsNodeLibraryOpen(!isNodeLibraryOpen)}
        onAddNode={handleAddNodeFromLibrary}
        onOpenAppSearch={() => setIsSearchModalOpen(true)}
        workflowName={projectName}
        workflowIcon={projectIcon}
        workflowDescription={projectDescription}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* App Search Modal */}
        <AppSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelect={handleSelectApp}
          excludedAppId={currentAppId}
        />

        {/* ReactFlow 캔버스 */}
        <div
          className="flex-1 relative"
          onContextMenu={(e) => e.preventDefault()}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onMoveEnd={handleMoveEnd}
            onNodeClick={handleNodeClick}
            onPaneContextMenu={onPaneContextMenu}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineStyle={{
              strokeWidth: 2,
              stroke: '#9ca3af',
              strokeLinecap: 'round',
            }}
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
          </ReactFlow>

          {/* 플로팅 하단 패널 */}
          <BottomPanel
            onCenterNodes={centerNodes}
            isPanelOpen={!!selectedNodeId}
            onOpenAppSearch={() => setIsSearchModalOpen(true)}
          />

          {/* [LLM] 파라미터 사이드 패널 */}
          {isParamPanelOpen &&
            selectedNodeType === 'llmNode' &&
            selectedNode && (
              <LLMParameterSidePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
                onClose={() => setIsParamPanelOpen(false)}
              />
            )}

          {/* 노드 상세 패널 */}
          <NodeDetailsPanel
            nodeId={selectedNodeId}
            onClose={handleClosePanel}
            header={panelHeader}
            headerActions={
              selectedNodeType === 'llmNode' ? (
                <button
                  onClick={() => {
                    setIsRefPanelOpen(false);
                    setIsParamPanelOpen((prev) => !prev);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isParamPanelOpen
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                  title="LLM 파라미터 설정"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>파라미터</span>
                </button>
              ) : undefined
            }
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
            {selectedNode && selectedNodeType === 'httpRequestNode' && (
              <HttpRequestNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'slackPostNode' && (
              <SlackPostNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'codeNode' && (
              <CodeNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'conditionNode' && (
              <ConditionNodePanel
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
            {selectedNode && selectedNodeType === 'templateNode' && (
              <TemplateNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'workflowNode' && (
              <WorkflowNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'fileExtractionNode' && (
              <FileExtractionNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'webhookTrigger' && (
              <WebhookTriggerNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'githubNode' && (
              <GithubNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
            {selectedNode && selectedNodeType === 'mailNode' && (
              <MailNodePanel
                nodeId={selectedNode.id}
                data={selectedNode.data as any}
              />
            )}
          </NodeDetailsPanel>

          {/* [LLM] Reference Side Panel */}
          {isRefPanelOpen && selectedNodeType === 'llmNode' && selectedNode && (
            <LLMReferenceSidePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
              onClose={() => setIsRefPanelOpen(false)}
            />
          )}

          {/* Context Menu UI */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleAddNodeFromContext}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-gray-500" />
                노드 추가
              </button>
              <button
                onClick={handleAddMemoFromContext}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <StickyNote className="w-4 h-4 text-gray-500" />
                메모 추가
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={handleTestRunFromContext}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Play className="w-4 h-4 text-gray-500" />
                테스트 실행
              </button>
            </div>
          )}

          {/* Context Menu Node Selector Modal */}
          {isContextNodeSelectorOpen && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[320px] max-h-[400px] overflow-y-auto"
              style={{
                left: contextMenuPos.x,
                top:
                  typeof window !== 'undefined' &&
                  window.innerHeight - contextMenuPos.y < 420
                    ? 'auto'
                    : contextMenuPos.y,
                bottom:
                  typeof window !== 'undefined' &&
                  window.innerHeight - contextMenuPos.y < 420
                    ? window.innerHeight - contextMenuPos.y
                    : 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-gray-900">
                  노드 선택
                </span>
                <button
                  onClick={() => setIsContextNodeSelectorOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <NodeSelector onSelect={handleSelectNodeFromContext} />
            </div>
          )}

          {/* Close Node Selector when clicking outside (overlay) */}
          {isContextNodeSelectorOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsContextNodeSelectorOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
