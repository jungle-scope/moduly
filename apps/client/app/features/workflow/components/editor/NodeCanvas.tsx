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
import { HttpRequestNodePanel } from '../nodes/http/components/HttpRequestNodePanel';
import { CodeNodePanel } from '../nodes/code/components/CodeNodePanel';
import { ConditionNodePanel } from '../nodes/condition/components/ConditionNodePanel';
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

  // 세부 정보 패널을 위한 선택된 노드 추적
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);

  const nodeTypes = useMemo(
    () => ({
      ...coreNodeTypes,
      note: NotePost,
    }),
    [],
  ) as unknown as NodeTypes;

  // 워크플로우 전환 시 뷰포트 복원
  useEffect(() => {
    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    if (activeWorkflow?.viewport) {
      setViewport(activeWorkflow.viewport);
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
      setSelectedNodeId(node.id);
      setSelectedNodeType(node.type);
    }
  }, []);

  // 세부 정보 패널 닫기
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
  }, []);

  // 선택된 노드 데이터 가져오기
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

  return (
    <div className="flex-1 bg-gray-50 relative flex flex-col">
      {/* 워크플로우 탭 */}
      <WorkflowTabs />

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
        </NodeDetailsPanel>
      </div>
    </div>
  );
}
