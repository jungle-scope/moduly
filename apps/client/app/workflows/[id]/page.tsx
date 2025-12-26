'use client';

import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../../features/workflow/components/nodes';
import { useWorkflowStore } from '../../features/workflow/store/useWorkflowStore';
import { useAutoSync } from '../../features/workflow/hooks/useAutoSync';

export default function WorkflowPage() {
  // Zustand Store에서 상태 가져오기
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);

  // 자동 저장 활성화 (500ms 디바운스)
  useAutoSync();

  return (
    <div className="h-screen w-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
