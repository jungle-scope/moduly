'use client';

import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../../features/workflow/components/nodes';
import { StartNodeData } from '../../features/workflow/types/Nodes';

const initialNodes = [
  {
    id: 'start-1',
    type: 'startNode',
    position: { x: 250, y: 250 },
    data: { title: '시작', triggerType: 'Manual' } as StartNodeData,
  },
];

export default function WorkflowPage() {
  return (
    <div className="h-screen w-full bg-background">
      <ReactFlow defaultNodes={initialNodes} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
