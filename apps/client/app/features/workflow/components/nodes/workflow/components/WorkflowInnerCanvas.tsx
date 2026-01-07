import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  Node,
  Edge,
  NodeTypes,
} from '@xyflow/react';
import { useMemo } from 'react';
import '@xyflow/react/dist/style.css';

import { nodeTypes as coreNodeTypes } from '../../index';

// 내부 노드용 간단한 노트 컴포넌트 등 필요하면 추가
// 여기서는 기존 노드를 그대로 쓰되 interaction만 막음

import { PuzzleEdge } from '../../edges/PuzzleEdge';

interface WorkflowInnerCanvasProps {
  nodes: Node[];
  edges: Edge[];
  allowNavigation?: boolean;
}

const InnerCanvasContent = ({
  nodes,
  edges,
  allowNavigation = false,
}: WorkflowInnerCanvasProps) => {
  // 노드 타입 메모이제이션
  const nodeTypes = useMemo(
    () => ({ ...coreNodeTypes }),
    [],
  ) as unknown as NodeTypes;

  // 엣지 타입 메모이제이션
  const edgeTypes = useMemo(() => ({ puzzle: PuzzleEdge }), []);

  // 기본 엣지 스타일 설정 (메인 캔버스와 동일하게)
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'puzzle',
      style: {
        strokeWidth: 10,
        stroke: '#d1d5db',
        strokeLinecap: 'round' as const,
        strokeDasharray: '0 20',
      },
      animated: false,
    }),
    [],
  );

  // 읽기 전용 모드 설정
  const defaultViewport = { x: 0, y: 0, zoom: 0.5 }; // 초기 줌 레벨

  return (
    <div className="w-full h-full bg-gray-50/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        // 상호작용 비활성화 (네비게이션 허용 시 줌/팬만 활성화)
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={allowNavigation}
        panOnScroll={allowNavigation}
        zoomOnPinch={allowNavigation}
        panOnDrag={allowNavigation}
        zoomOnDoubleClick={allowNavigation}
        preventScrolling={!allowNavigation}
        // 기본 뷰포트 설정
        defaultViewport={defaultViewport}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="opacity-50"
        />
      </ReactFlow>
    </div>
  );
};

export const WorkflowInnerCanvas = ({
  nodes,
  edges,
  allowNavigation,
}: WorkflowInnerCanvasProps) => {
  // 별도의 Provider로 감싸서 메인 캔버스와 상태 격리
  return (
    <ReactFlowProvider>
      <InnerCanvasContent
        nodes={nodes}
        edges={edges}
        allowNavigation={allowNavigation}
      />
    </ReactFlowProvider>
  );
};
