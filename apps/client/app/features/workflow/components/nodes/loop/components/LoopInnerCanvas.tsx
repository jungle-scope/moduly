import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  Node,
  Edge,
  NodeTypes,
} from '@xyflow/react';
import { useMemo, useCallback } from 'react';
import '@xyflow/react/dist/style.css';

import { nodeTypes as coreNodeTypes } from '../../index';
import { PuzzleEdge } from '../../edges/PuzzleEdge';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';

interface LoopInnerCanvasProps {
  nodes: Node[];
  edges: Edge[];
  parentNodeId: string; // Parent Loop node ID
}

const InnerCanvasContent = ({
  nodes,
  edges,
  parentNodeId,
}: LoopInnerCanvasProps) => {
  const { setSelectedInnerNode } = useWorkflowStore();

  // 노드 타입 메모이제이션
  const nodeTypes = useMemo(
    () => ({ ...coreNodeTypes }),
    [],
  ) as unknown as NodeTypes;

  // 엣지 타입 메모이제이션
  const edgeTypes = useMemo(() => ({ puzzle: PuzzleEdge }), []);

  // 기본 뷰포트 설정
  const defaultViewport = { x: 20, y: 20, zoom: 0.8 };

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedInnerNode(parentNodeId, node.id);
    },
    [parentNodeId, setSelectedInnerNode],
  );

  return (
    <div className="w-full h-full bg-gray-50/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        // 상호작용 설정 - 선택만 가능하도록
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true} // 선택 가능하도록 변경
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnPinch={false}
        panOnDrag={false}
        zoomOnDoubleClick={false}
        preventScrolling={true}
        // 기본 뷰포트
        defaultViewport={defaultViewport}
        // 노드 클릭 핸들러 추가
        onNodeClick={handleNodeClick}
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

export const LoopInnerCanvas = ({
  nodes,
  edges,
  parentNodeId,
}: LoopInnerCanvasProps) => {
  // 별도의 Provider로 감싸서 메인 캔버스와 상태 격리
  return (
    <ReactFlowProvider>
      <InnerCanvasContent
        nodes={nodes}
        edges={edges}
        parentNodeId={parentNodeId}
      />
    </ReactFlowProvider>
  );
};
