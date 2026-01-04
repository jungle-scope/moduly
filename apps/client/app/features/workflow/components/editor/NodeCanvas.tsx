'use client';

import { Sliders } from 'lucide-react';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type Viewport,
  type NodeTypes,
  // type Node, // 충돌 방지를 위해 제거됨
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { WorkflowNodeData, Node } from '../../types/Nodes';
import { nodeTypes as coreNodeTypes } from '../nodes';
import NotePost from './NotePost';
import BottomPanel from './BottomPanel';
import NodeDetailsPanel from './NodeDetailsPanel';
import { getNodeDefinitionByType } from '../../config/nodeRegistry';
import { StartNodePanel } from '../nodes/start/components/StartNodePanel';
import { AnswerNodePanel } from '../nodes/answer/components/AnswerNodePanel';
import { HttpRequestNodePanel } from '../nodes/http/components/HttpRequestNodePanel';
import { CodeNodePanel } from '../nodes/code/components/CodeNodePanel';
import { ConditionNodePanel } from '../nodes/condition/components/ConditionNodePanel';
import { LLMNodePanel } from '../nodes/llm/components/LLMNodePanel';
import { TemplateNodePanel } from '../nodes/template/components/TemplateNodePanel';
import { WorkflowNodePanel } from '../nodes/workflow/components/WorkflowNodePanel';
import { KnowledgeNodePanel } from '../nodes/knowledge/components/KnowledgeNodePanel';

import { AppSearchModal } from '../modals/AppSearchModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { App } from '@/app/features/app/api/appApi';
import { FileExtractionNodePanel } from '../nodes/file_extraction/components/FileExtractionNodePanel';
import { WebhookTriggerNodePanel } from '../nodes/webhook/components/WebhookTriggerNodePanel';
import { LLMParameterSidePanel } from '../nodes/llm/components/LLMParameterSidePanel';

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
  } = useWorkflowStore();

  const { fitView, setViewport, getViewport, screenToFlowPosition } =
    useReactFlow();
  // 세부 정보 패널을 위한 선택된 노드 추적
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);

  // 앱 검색 모달 상태
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // [LLM] 파라미터 패널 상태
  const [isParamPanelOpen, setIsParamPanelOpen] = useState(false);

  // 키보드 단축키: 검색 모달을 열기 위한 Cmd+K
  useKeyboardShortcut(
    ['Meta', 'k'],
    () => {
      setIsSearchModalOpen(true);
    },
    { preventDefault: true },
  );

  // 앱 선택 처리: 워크플로우 노드 추가
  const handleSelectApp = useCallback(
    (app: App & { active_deployment_id?: string; version?: number }) => {
      // 화면 중앙 위치 계산
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
        } as WorkflowNodeData,
      };

      setNodes([...nodes, newNode]);
      setIsSearchModalOpen(false);
    },
    [nodes, setNodes, screenToFlowPosition],
  );

  const nodeTypes = useMemo(
    () => ({
      ...coreNodeTypes,
      note: NotePost,
    }),
    [],
  ) as unknown as NodeTypes;

  // 워크플로우 전환 시 뷰포트 복원
  const prevActiveWorkflowId = useRef(activeWorkflowId);

  useEffect(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

    // 워크플로우 ID가 바뀌었을 때만 뷰포트 복원
    if (prevActiveWorkflowId.current !== activeWorkflowId) {
      if (activeWorkflow?.viewport) {
        setViewport(activeWorkflow.viewport);
      }
      prevActiveWorkflowId.current = activeWorkflowId;
    }
  }, [activeWorkflowId, workflows, setViewport]);

  // 활성 워크플로우에 대한 뷰포트 변경 사항 저장
  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      // Zustand에 저장 → useAutoSync가 자동으로 감지하여 서버에 저장
      updateWorkflowViewport(activeWorkflowId, viewport);
    },
    [activeWorkflowId, updateWorkflowViewport],
  );

  // 노드 클릭 시 세부 정보 패널 표시 처리
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // 워크플로우 노드에 대해서만 패널 표시 (노트 제외)
    if (node.type && node.type !== 'note') {
      // 다른 노드 선택 시 파라미터 패널 닫기 (선택 사항 - 여기선 유지하거나 닫을 수 있음. 일단 닫음)
      if (selectedNodeId !== node.id) {
        setIsParamPanelOpen(false);
      }
      setSelectedNodeId(node.id);
      setSelectedNodeType(node.type);
    }
  }, [selectedNodeId]);

  // 세부 정보 패널 닫기
  // 세부 정보 패널 닫기
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
    setIsParamPanelOpen(false);
  }, []);

  // 선택된 노드 데이터 가져오기
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId);
  }, [selectedNodeId, nodes]);

  const panelHeader = useMemo(() => {
    if (!selectedNodeType) return undefined;
    const def = getNodeDefinitionByType(selectedNodeType);
    // Workflow Node의 경우 아이콘과 제목을 동적으로 설정할 수 있음
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

  // 인터랙티브 모드에 따라 ReactFlow 구성
  const reactFlowConfig = useMemo(() => {
    if (interactiveMode === 'touchpad') {
      return {
        panOnDrag: [1, 2], // 두 손가락으로 이동 (중간 및 오른쪽 마우스 버튼으로 시뮬레이션)
        panOnScroll: true, // 스크롤로 이동 활성화
        zoomOnScroll: false, // 스크롤로 줌 비활성화
        zoomOnPinch: true, // 핀치 줌 활성화
        selectionOnDrag: true, // 왼쪽 클릭으로 노드 선택 및 드래그 허용
      };
    } else {
      // 마우스 친화적 모드
      return {
        panOnDrag: true, // 왼쪽 클릭 드래그로 이동
        panOnScroll: false, // 스크롤 시 이동하지 않음
        zoomOnScroll: true, // 스크롤 휠로 줌
        zoomOnPinch: true, // 핀치 줌도 지원
        selectionOnDrag: false,
      };
    }
  }, [interactiveMode]);

  const centerNodes = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
    // 중앙 정렬 후 새로운 뷰포트 저장
    setTimeout(() => {
      const viewport = getViewport();
      updateWorkflowViewport(activeWorkflowId, viewport);
    }, 300);
  }, [fitView, getViewport, activeWorkflowId, updateWorkflowViewport]);

  // 현재 워크플로우의 앱 ID 찾기
  const currentAppId = useMemo(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    return activeWorkflow?.appId;
  }, [workflows, activeWorkflowId]);

  return (
    <div className="flex-1 bg-gray-50 relative flex flex-col">
      {/* App Search Modal */}
      <AppSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelect={handleSelectApp}
        excludedAppId={currentAppId}
      />

      {/* ReactFlow 캔버스 */}

      {/* ReactFlow 캔버스 */}
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
          <Controls className="shadow-lg! border! border-gray-200! rounded-lg!" />
        </ReactFlow>

        {/* 플로팅 하단 패널 - 사이드 패널에 따라 위치 조정 */}
        <BottomPanel
          onCenterNodes={centerNodes}
          isPanelOpen={!!selectedNodeId}
          onOpenAppSearch={() => setIsSearchModalOpen(true)}
        />

        {/* 노드 상세 패널 - ReactFlow 컨테이너 기준으로 위치 */}
        {/* [LLM] 파라미터 사이드 패널 (NodeDetailsPanel 왼쪽에 위치) */}
        {isParamPanelOpen && selectedNodeType === 'llmNode' && selectedNode && (
          <LLMParameterSidePanel
            nodeId={selectedNode.id}
            data={selectedNode.data as any}
            onClose={() => setIsParamPanelOpen(false)}
          />
        )}

        <NodeDetailsPanel
          nodeId={selectedNodeId}
          onClose={handleClosePanel}
          header={panelHeader}
          headerActions={
            selectedNodeType === 'llmNode' ? (
              <button
                onClick={() => setIsParamPanelOpen((prev) => !prev)}
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

          {/* NOTE: [TemplateNode] TemplateNode 선택 시 패널 렌더링 추가 */}
          {selectedNode && selectedNodeType === 'templateNode' && (
            <TemplateNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
          {/* [WorkflowNode] 모듈 입력 매핑 패널 추가 */}
          {selectedNode && selectedNodeType === 'workflowNode' && (
            <WorkflowNodePanel
              nodeId={selectedNode.id}
              data={selectedNode.data as any}
            />
          )}
          {selectedNode && selectedNodeType === 'knowledgeNode' && (
            <KnowledgeNodePanel
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
        </NodeDetailsPanel>
      </div>
    </div>
  );
}
