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

interface WorkflowInnerCanvasProps {
  nodes: Node[];
  edges: Edge[];
}

const InnerCanvasContent = ({ nodes, edges }: WorkflowInnerCanvasProps) => {
  // 노드 타입 메모이제이션
  const nodeTypes = useMemo(
    () => ({ ...coreNodeTypes }),
    [],
  ) as unknown as NodeTypes;

  // 읽기 전용 모드 설정
  const defaultViewport = { x: 0, y: 0, zoom: 0.5 }; // 초기 줌 레벨

  return (
    <div className="w-full h-full bg-gray-50/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        // 상호작용 비활성화
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnPinch={false}
        panOnDrag={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
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
}: WorkflowInnerCanvasProps) => {
  // 별도의 Provider로 감싸서 메인 캔버스와 상태 격리
  return (
    <ReactFlowProvider>
      <InnerCanvasContent nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
};
