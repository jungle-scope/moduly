'use client';

import {
  Sliders,
  Plus,
  StickyNote,
  Play,
  Trash2,
  Workflow,
  ScrollText,
  Activity,
  Settings,
} from 'lucide-react';
import { ClockIcon } from '@/app/features/workflow/components/nodes/icons';
import { NodeSelector } from './NodeSelector';
import { LogTab } from './tabs/LogTab';
import { MonitoringTab } from './tabs/MonitoringTab';
import NodeLibrarySidebar from './NodeLibrarySidebar';
import {
  type NodeDefinition,
  getNodeDefinition,
} from '../../config/nodeRegistry';
import { NoteNode, AppNode } from '../../types/Nodes';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type NodeTypes,
  type Edge,
} from '@xyflow/react';
import dagre from 'dagre';

import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { WorkflowNodeData, Node } from '../../types/Nodes';
import { nodeTypes as coreNodeTypes } from '../nodes';
import { PuzzleEdge } from '../nodes/edges/PuzzleEdge';
import { CustomConnectionLine } from '../nodes/edges/CustomConnectionLine';
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
import { LoopNodePanel } from '../nodes/loop/components/LoopNodePanel';
import { AppSearchModal } from '../modals/AppSearchModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { App } from '@/app/features/app/api/appApi';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { FileExtractionNodePanel } from '../nodes/file_extraction/components/FileExtractionNodePanel';
import { WebhookTriggerNodePanel } from '../nodes/webhook/components/WebhookTriggerNodePanel';
import { ScheduleTriggerNodePanel } from '../nodes/schedule/components/ScheduleTriggerNodePanel';
import { LLMParameterSidePanel } from '../nodes/llm/components/LLMParameterSidePanel';
import { LLMReferenceSidePanel } from '../nodes/llm/components/LLMReferenceSidePanel';
import { useDragConnectionPreview } from '../../hooks/useDragConnectionPreview';
import { DragConnectionOverlay } from './DragConnectionOverlay';
import { MemoryModeToggle, useMemoryMode } from './memory/MemoryModeControls';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SettingsSidebar } from './SettingsSidebar';
import { VersionHistorySidebar } from './VersionHistorySidebar';
import { TestSidebar } from './TestSidebar';
import { DeploymentFlowModal } from '../deployment/DeploymentFlowModal';
import type { DeploymentResult } from '../deployment/types';

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
    setEdges,
    isSettingsOpen,
    toggleSettings,
    isTestPanelOpen,
    toggleTestPanel,
    clearInnerNodeSelection,
    selectedInnerNode,
  } = useWorkflowStore();

  const { fitView, setViewport, getViewport, screenToFlowPosition, deleteElements } =
    useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);
  const [searchModalContext, setSearchModalContext] = useState<{
    isOpen: boolean;
    position?: { x: number; y: number };
  }>({ isOpen: false });
  const [isParamPanelOpen, setIsParamPanelOpen] = useState(false);
  const [isRefPanelOpen, setIsRefPanelOpen] = useState(false);
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(true);

  // Drag connection preview
  const {
    previewState,
    onDragOver: handleDragOver,
    resetPreview,
  } = useDragConnectionPreview(nodes);

  // Memory mode controls
  const router = useRouter();
  const {
    isMemoryModeEnabled,
    hasProviderKey,
    memoryModeDescription,
    toggleMemoryMode,
    modals: memoryModeModals,
  } = useMemoryMode(router, toast);

  // Publish state
  const canPublish = useWorkflowStore((state) => state.canPublish());
  const [showDeployFlowModal, setShowDeployFlowModal] = useState(false);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [deploymentType, setDeploymentType] = useState<
    'api' | 'webapp' | 'widget' | 'workflow_node'
  >('api');

  // 배포 드롭다운 토글 시 다른 패널 닫기
  const toggleDeployDropdown = useCallback(() => {
    if (!showDeployDropdown) {
      // 열릴 때 다른거 다 닫기
      if (isSettingsOpen) toggleSettings();
      if (isVersionHistoryOpen) toggleVersionHistory();
      if (isTestPanelOpen) toggleTestPanel();
      setSelectedNodeId(null);
      setSelectedNodeType(null);
    }
    setShowDeployDropdown((prev) => !prev);
  }, [
    showDeployDropdown,
    isSettingsOpen,
    toggleSettings,
    isVersionHistoryOpen,
    toggleVersionHistory,
    isTestPanelOpen,
    toggleTestPanel,
  ]);

  // Handle deployments
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  const handlePublishAsRestAPI = useCallback(() => {
    setDeploymentType('api');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWebApp = useCallback(() => {
    setDeploymentType('webapp');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWidget = useCallback(() => {
    setDeploymentType('widget');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handlePublishAsWorkflowNode = useCallback(() => {
    setDeploymentType('workflow_node');
    setShowDeployFlowModal(true);
    setShowDeployDropdown(false);
  }, []);

  const handleDeploy = useCallback(
    async (description: string): Promise<DeploymentResult> => {
      try {
        if (!activeWorkflow?.appId) {
          throw new Error('App ID를 찾을 수 없습니다.');
        }

        const response = await workflowApi.createDeployment({
          app_id: activeWorkflow.appId,
          description,
          type: deploymentType,
          is_active: true,
        });

        useWorkflowStore.getState().notifyDeploymentComplete();

        const result: DeploymentResult = {
          success: true,
          url_slug: response.url_slug ?? null,
          auth_secret: response.auth_secret ?? null,
          version: response.version,
          input_schema: response.input_schema ?? null,
          output_schema: response.output_schema ?? null,
        };

        if (deploymentType === 'webapp') {
          result.webAppUrl = `${window.location.origin}/shared/${response.url_slug}`;
        } else if (deploymentType === 'widget') {
          result.embedUrl = `${window.location.origin}/embed/chat/${response.url_slug}`;
        } else if (deploymentType === 'workflow_node') {
          result.isWorkflowNode = true;
          result.auth_secret = null;
        }

        return result;
      } catch (error: any) {
        console.error(`[${deploymentType} 배포 실패]:`, error);
        return {
          success: false,
          message:
            error.response?.data?.detail || '배포 중 오류가 발생했습니다.',
        };
      }
    },
    [deploymentType, activeWorkflow?.appId],
  );

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
      setSearchModalContext({ isOpen: true });
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

  // 설정, 버전 기록, 테스트 패널이 열리면 노드 상세 패널과 배포 드롭다운 닫기
  useEffect(() => {
    if (isSettingsOpen || isVersionHistoryOpen || isTestPanelOpen) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
      setIsParamPanelOpen(false);
      setIsRefPanelOpen(false);
      setShowDeployDropdown(false);
    }
  }, [isSettingsOpen, isVersionHistoryOpen, isTestPanelOpen]);

  const handleSelectApp = useCallback(
    async (app: App & { active_deployment_id?: string; version?: number }) => {
      const newNode: Node = {
        id: `workflow-${Date.now()}`,
        type: 'workflowNode',
        position:
          searchModalContext.position ||
          screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          }),
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
      setSearchModalContext({ isOpen: false });

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
    [
      nodes,
      setNodes,
      screenToFlowPosition,
      updateNodeData,
      searchModalContext.position,
    ],
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
    if (isVersionHistoryOpen || isSettingsOpen) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
      setIsParamPanelOpen(false);
    }
  }, [isVersionHistoryOpen, isSettingsOpen]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type && node.type !== 'note') {
        if (isVersionHistoryOpen) {
          toggleVersionHistory();
        }
        if (isSettingsOpen) {
          toggleSettings();
        }
        if (isTestPanelOpen) {
          toggleTestPanel();
        }

        if (selectedNodeId !== node.id) {
          setIsParamPanelOpen(false);
          setIsRefPanelOpen(false);
        }
        // 메인 노드 클릭 시 내부 노드 선택 해제
        clearInnerNodeSelection();
        setSelectedNodeId(node.id);
        setSelectedNodeType(node.type);
      }
    },
    [
      selectedNodeId,
      isVersionHistoryOpen,
      toggleVersionHistory,
      isSettingsOpen,
      toggleSettings,
      isTestPanelOpen,
      toggleTestPanel,
      clearInnerNodeSelection,
    ],
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
        connectionRadius: 50,
      };
    } else {
      return {
        panOnDrag: true,
        panOnScroll: false,
        zoomOnScroll: true,
        zoomOnPinch: true,
        selectionOnDrag: false,
        connectionRadius: 50,
      };
    }
  }, [interactiveMode]);

  const handleAutoLayout = useCallback(() => {
    // 1. 노드 초기화 및 DAGRE 그래프 생성
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // [MODIFIED] 간격을 넓혀서 엣지가 더 잘 보이도록 설정
    dagreGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 80 });

    const nodeWidth = 300;
    const nodeHeight = 150;

    // 2. 연결된 노드와 고립된 노드 분류
    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const connectedNodes: AppNode[] = [];
    nodes.forEach((node) => {
      if (node.type === 'note') return;

      if (connectedNodeIds.has(node.id)) {
        connectedNodes.push(node);

        let width = nodeWidth;
        let height = nodeHeight;

        // 서브모듈 노드가 펼쳐져 있는 경우 동적 크기 계산
        if (
          node.type === 'workflowNode' &&
          (node.data as any).expanded &&
          (node.data as any).graph_snapshot
        ) {
          try {
            const snapshot = (node.data as any).graph_snapshot;
            const subNodes = (snapshot.nodes as any[]) || [];
            const subEdges = (snapshot.edges as any[]) || [];

            // 시작 노드 찾기
            const startNode = subNodes.find(
              (n) => n.type === 'start' || n.type === 'startNode',
            );

            let validNodes = subNodes;

            // 시작 노드가 있으면 도달 가능한 노드만 필터링 (WorkflowNode와 동일 로직)
            if (startNode) {
              const reachableIds = new Set<string>([startNode.id]);
              const queue = [startNode.id];

              while (queue.length > 0) {
                const curr = queue.shift()!;
                const outgoing = subEdges.filter((e) => e.source === curr);
                for (const e of outgoing) {
                  if (!reachableIds.has(e.target)) {
                    reachableIds.add(e.target);
                    queue.push(e.target);
                  }
                }
              }
              validNodes = subNodes.filter((n) => reachableIds.has(n.id));
            }

            if (validNodes.length > 0) {
              const bounds = validNodes.reduce(
                (acc, n) => {
                  const x = n.position.x;
                  const y = n.position.y;
                  const w =
                    (n.measured?.width as number) || (n.width as number) || 300;
                  const h =
                    (n.measured?.height as number) ||
                    (n.height as number) ||
                    150;
                  return {
                    minX: Math.min(acc.minX, x),
                    maxX: Math.max(acc.maxX, x + w),
                    minY: Math.min(acc.minY, y),
                    maxY: Math.max(acc.maxY, y + h),
                  };
                },
                {
                  minX: Infinity,
                  maxX: -Infinity,
                  minY: Infinity,
                  maxY: -Infinity,
                },
              );

              const PADDING = 60;
              let calcWidth =
                bounds.minX === Infinity
                  ? 600
                  : bounds.maxX - bounds.minX + PADDING * 2;

              // 최소 너비 보정
              const minWidthByCount = validNodes.length * 100;
              calcWidth = Math.max(calcWidth, minWidthByCount);

              const calcHeight =
                bounds.minY === Infinity
                  ? 300
                  : bounds.maxY - bounds.minY + PADDING * 2;

              // 제한 적용
              const containerWidth = Math.min(Math.max(calcWidth, 600), 1800);
              const containerHeight = Math.min(Math.max(calcHeight, 300), 1200);

              // 80% 축소 적용
              width = Math.round(containerWidth * 0.8);
              height = containerHeight;
            }
          } catch (e) {
            console.error('Failed to calculate submodule size for layout', e);
          }
        }

        dagreGraph.setNode(node.id, { width, height });
      }
    });

    edges.forEach((edge) => {
      if (
        connectedNodeIds.has(edge.source) &&
        connectedNodeIds.has(edge.target)
      ) {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    });

    // 3. Dagre 레이아웃 계산 (연결된 노드)
    dagre.layout(dagreGraph);

    // 4. 새 위치 적용 및 고립된 노드 배치 준비
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;

    const layoutedNodes = nodes.map((node) => {
      if (node.type === 'note') return node;

      if (connectedNodeIds.has(node.id)) {
        const nodeWithPosition = dagreGraph.node(node.id);
        const x = nodeWithPosition.x - nodeWithPosition.width / 2;
        const y = nodeWithPosition.y - nodeWithPosition.height / 2;

        // Bounding Box 계산
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + nodeWithPosition.width);
        if (y + nodeWithPosition.height > maxY) {
          maxY = y + nodeWithPosition.height;
        }

        return {
          ...node,
          position: { x, y },
        };
      }
      return node;
    });

    // 만약 연결된 노드가 하나도 없으면 기본값 설정
    if (minX === Infinity) minX = 0;
    if (maxX === -Infinity) maxX = 1000; // 기본 너비

    // [MODIFIED] 고립된 노드(Orphan Nodes) 그리드 배치
    const orphanStartY = maxY + 150; // 연결된 그래프와 충분한 간격
    let currentX = minX;
    let currentY = orphanStartY;
    const gapX = 50;
    const gapY = 50;

    // 연결된 그래프의 너비를 기준으로 줄바꿈 (최소 1000px 보장)
    const maxWidth = Math.max(maxX - minX, 1000);

    const finalNodes = layoutedNodes.map((node) => {
      if (connectedNodeIds.has(node.id) || node.type === 'note') return node;

      // 위치 할당
      const newNode = {
        ...node,
        position: { x: currentX, y: currentY },
      };

      // 다음 위치 계산
      currentX += nodeWidth + gapX;

      // 줄바꿈 체크 (시작점으로부터의 거리가 최대 너비를 넘으면)
      if (currentX - minX > maxWidth) {
        currentX = minX;
        currentY += nodeHeight + gapY;
      }

      return newNode;
    });

    setNodes(finalNodes);

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
      const viewport = getViewport();
      updateWorkflowViewport(activeWorkflowId, viewport);
    }, 100);
  }, [
    nodes,
    edges,
    setNodes,
    fitView,
    getViewport,
    updateWorkflowViewport,
    activeWorkflowId,
  ]);

  const currentAppId = useMemo(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    return activeWorkflow?.appId;
  }, [workflows, activeWorkflowId]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  } | null>(null);

  // 노드/Edge 우클릭 삭제 메뉴용 state
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    x: number;
    y: number;
    edgeId: string;
  } | null>(null);

  const [isContextNodeSelectorOpen, setIsContextNodeSelectorOpen] =
    useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  // 노드 우클릭 핸들러
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      setNodeContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
      setEdgeContextMenu(null);
      setContextMenu(null);
    },
    [],
  );

  // Edge 우클릭 핸들러
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: { id: string }) => {
      event.preventDefault();
      event.stopPropagation();
      setEdgeContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      });
      setNodeContextMenu(null);
      setContextMenu(null);
    },
    [],
  );

  // 노드 삭제 핸들러 (React Flow 내부 로직 사용)
  const handleDeleteNode = useCallback(() => {
    if (!nodeContextMenu) return;
    deleteElements({ nodes: [{ id: nodeContextMenu.nodeId }] });
    setNodeContextMenu(null);
  }, [nodeContextMenu, deleteElements]);

  // Edge 삭제 핸들러 (React Flow 내부 로직 사용)
  const handleDeleteEdge = useCallback(() => {
    if (!edgeContextMenu) return;
    deleteElements({ edges: [{ id: edgeContextMenu.edgeId }] });
    setEdgeContextMenu(null);
  }, [edgeContextMenu, deleteElements]);

  // Delete 키 핸들러 (React Flow 내부 로직 사용)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // input/textarea에서는 무시
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'Delete') {
        // 선택된 노드/엣지가 있으면 삭제
        const selectedNodes = nodes.filter((n) => n.selected);
        const selectedEdges = edges.filter((e) => e.selected);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault();
          deleteElements({
            nodes: selectedNodes.map((n) => ({ id: n.id })),
            edges: selectedEdges.map((e) => ({ id: e.id })),
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, deleteElements]);

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

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
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
      style: { width: 300, height: 100 },
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

      // [MODIFIED] 워크플로우 노드(모듈)인 경우, 바로 추가하지 않고 검색 모달을 엽니다.
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

      // Use preview position if available, otherwise use mouse position
      const position =
        previewState.draggedNodePosition ||
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

      // [MODIFIED] 워크플로우 노드(모듈)인 경우, 바로 추가하지 않고 검색 모달을 엽니다.
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

      setNodes([...filteredNodes, newNode]);

      // Auto-connect if there's a nearest node
      if (previewState.nearestNode) {
        const newEdge = {
          id: `e-${Date.now()}`,
          source: previewState.isRight
            ? previewState.nearestNode.id
            : newNode.id,
          target: previewState.isRight
            ? newNode.id
            : previewState.nearestNode.id,
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
    ],
  );

  // onDragOver is now handled by useDragPreview hook

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

  // [NEW] 탭 상태
  const [activeTab, setActiveTab] = useState<'editor' | 'logs' | 'monitoring'>(
    'editor',
  );
  const [initialLogRunId, setInitialLogRunId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const runIdParam = searchParams.get('runId');

  useEffect(() => {
    if (tabParam === 'monitoring' || tabParam === 'logs') {
      setActiveTab(tabParam);
      setIsNodeLibraryOpen(false);
    } else if (tabParam === 'editor') {
      setActiveTab('editor');
      setIsNodeLibraryOpen(true);
    }
  }, [tabParam]);

  useEffect(() => {
    if (runIdParam) {
      setInitialLogRunId(runIdParam);
    }
  }, [runIdParam]);

  return (
    <div className="flex-1 bg-gradient-to-r from-blue-50 via-white to-blue-50/30 p-2 relative flex flex-col overflow-hidden">
      {/* Main Content Area Container */}
      <div className="flex-1 h-full rounded-xl bg-gray-100 flex flex-col overflow-hidden">
        {/* Tab Header */}
        <div className="h-10 min-h-[40px] px-2 pt-2 bg-gray-100 flex items-end justify-between shrink-0">
          {/* Left: Tab Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setActiveTab('editor');
                setIsNodeLibraryOpen(true);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg relative z-10 transition-all ${
                activeTab === 'editor'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Workflow className="w-4 h-4" />
              편집
            </button>
            <button
              onClick={() => {
                setActiveTab('logs');
                setIsNodeLibraryOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg relative z-10 transition-all ${
                activeTab === 'logs'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <ScrollText className="w-4 h-4" />
              로그
            </button>
            <button
              onClick={() => {
                setActiveTab('monitoring');
                setIsNodeLibraryOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg relative z-10 transition-all ${
                activeTab === 'monitoring'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              모니터링
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* 1. Editor Tab Content */}
          <div
            className={`w-full h-full relative flex flex-row gap-2 ${
              activeTab === 'editor' ? 'flex' : 'hidden'
            }`}
          >
            {/* Node Library Sidebar */}
            <div className="pl-2 pt-2 h-full flex flex-col">
              <div
                className={`flex-1 rounded-xl border border-gray-200 bg-white transition-all duration-300 ease-in-out z-20 ${
                  isNodeLibraryOpen ? 'w-64' : 'w-12'
                }`}
              >
                <NodeLibrarySidebar
                  isOpen={isNodeLibraryOpen}
                  onToggle={() => setIsNodeLibraryOpen(!isNodeLibraryOpen)}
                  onAddNode={handleAddNodeFromLibrary}
                  onOpenAppSearch={() =>
                    setSearchModalContext({ isOpen: true })
                  }
                />
              </div>
            </div>

            {/* Editor Canvas Container */}
            <div className="flex-1 h-full relative flex flex-col overflow-hidden">
              {/* App Search Modal */}
              <AppSearchModal
                isOpen={searchModalContext.isOpen}
                onClose={() => setSearchModalContext({ isOpen: false })}
                onSelect={handleSelectApp}
                excludedAppId={currentAppId}
              />

              {/* ReactFlow 캔버스 */}
              <div
                className="w-full h-full relative"
                onContextMenu={(e) => e.preventDefault()}
                onDragOver={handleDragOver}
                onDrop={onDrop}
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
                  onNodeContextMenu={onNodeContextMenu}
                  onEdgeContextMenu={onEdgeContextMenu}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={defaultEdgeOptions}
                  connectionLineComponent={CustomConnectionLine}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                  minZoom={0.4}
                  maxZoom={1.6}
                  attributionPosition="bottom-right"
                  className="bg-gray-100"
                  {...reactFlowConfig}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="#d1d5db"
                  />
                </ReactFlow>

                {/* Drag connection preview overlay */}
                <DragConnectionOverlay
                  nearestNode={previewState.nearestNode}
                  draggedNodePosition={previewState.draggedNodePosition}
                  isRight={previewState.isRight}
                />

                {/* Right: Action Buttons (Moved to Canvas) */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
                  {/* Group: Memory | Settings | Version | Test */}
                  <div className="h-8 flex items-center p-0.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="h-full flex items-center px-2">
                      <MemoryModeToggle
                        isEnabled={isMemoryModeEnabled}
                        hasProviderKey={hasProviderKey}
                        description={memoryModeDescription}
                        onToggle={toggleMemoryMode}
                      />
                    </div>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button
                      onClick={toggleSettings}
                      className="h-full px-2 flex items-center gap-1.5 rounded-md transition-colors hover:bg-gray-100 text-gray-600 text-[13px] font-medium"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>설정</span>
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button
                      onClick={toggleVersionHistory}
                      className="h-full px-2 flex items-center gap-1.5 rounded-md transition-colors hover:bg-gray-100 text-gray-600 text-[13px] font-medium"
                    >
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>버전</span>
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button
                      onClick={toggleTestPanel}
                      className="h-full px-2 flex items-center gap-1.5 rounded-md transition-colors hover:bg-gray-100 text-blue-600 font-medium text-[13px]"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>테스트</span>
                    </button>
                  </div>

                  {/* Standalone: Publish */}
                  <div className="relative">
                    <button
                      disabled={!canPublish}
                      onClick={toggleDeployDropdown}
                      className={`h-8 px-3.5 font-medium rounded-lg transition-colors flex items-center gap-1.5 text-[13px] shadow-sm ${
                        !canPublish
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      게시하기
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${
                          showDeployDropdown ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Deployment Dropdown */}
                    {showDeployDropdown && canPublish && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowDeployDropdown(false)}
                        />
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 text-left">
                          <button
                            onClick={handlePublishAsRestAPI}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              REST API로 배포
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              API 키로 접근
                            </div>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={handlePublishAsWebApp}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              웹 앱으로 배포
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              링크 공유로 누구나 사용
                            </div>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={handlePublishAsWidget}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              웹사이트에 챗봇 추가하기
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              복사 한 번으로 위젯 연동 완료
                            </div>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={handlePublishAsWorkflowNode}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              서브 모듈로 배포
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              다른 워크플로우에서 재사용
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 플로팅 하단 패널 */}
                <BottomPanel
                  onCenterNodes={handleAutoLayout}
                  isPanelOpen={!!selectedNodeId}
                  onOpenAppSearch={() =>
                    setSearchModalContext({ isOpen: true })
                  }
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
                {(selectedNodeId || selectedInnerNode) && (
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
                    {selectedNode &&
                      selectedNodeType === 'fileExtractionNode' && (
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
                    {selectedNode && selectedNodeType === 'scheduleTrigger' && (
                      <ScheduleTriggerNodePanel
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
                    {selectedNode && selectedNodeType === 'loopNode' && (
                      <LoopNodePanel
                        nodeId={selectedNode.id}
                        data={selectedNode.data as any}
                      />
                    )}
                  </NodeDetailsPanel>
                )}

                {/* [LLM] Reference Side Panel */}
                {isRefPanelOpen &&
                  selectedNodeType === 'llmNode' &&
                  selectedNode && (
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

                {/* 노드 우클릭 삭제 메뉴 */}
                {nodeContextMenu && (
                  <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]"
                    style={{ top: nodeContextMenu.y, left: nodeContextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handleDeleteNode}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      노드 삭제
                    </button>
                  </div>
                )}

                {/* Edge 우클릭 삭제 메뉴 */}
                {edgeContextMenu && (
                  <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]"
                    style={{ top: edgeContextMenu.y, left: edgeContextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handleDeleteEdge}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      연결선 삭제
                    </button>
                  </div>
                )}

                {/* Context Menu Node Selector Modal */}
                {isContextNodeSelectorOpen && (
                  <div
                    className="fixed z-50"
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

          {/* 2. Logs Tab Content */}
          {activeTab === 'logs' && (
            <LogTab
              workflowId={String(activeWorkflowId)}
              initialRunId={initialLogRunId}
            />
          )}

          {/* 3. Monitoring Tab Content */}
          {activeTab === 'monitoring' && (
            <MonitoringTab
              workflowId={String(activeWorkflowId)}
              onNavigateToLog={(runId) => {
                setInitialLogRunId(runId);
                setActiveTab('logs');
              }}
            />
          )}
        </div>
      </div>

      {/* Memory Mode Modals */}
      {memoryModeModals}

      {/* Sidebars */}
      <SettingsSidebar />
      <VersionHistorySidebar />
      <TestSidebar />

      {/* Deployment Flow Modal */}
      <DeploymentFlowModal
        isOpen={showDeployFlowModal}
        onClose={() => setShowDeployFlowModal(false)}
        deploymentType={deploymentType}
        onDeploy={handleDeploy}
      />
    </div>
  );
}
