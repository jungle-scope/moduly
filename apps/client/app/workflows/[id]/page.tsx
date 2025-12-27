'use client';

import { ReactFlowProvider } from '@xyflow/react';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import EditorSidebar from '@/app/features/workflow/components/editor/EditorSidebar';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';

export default function WorkflowPage() {
  // 자동 저장 활성화
  useAutoSync();

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-white">
        {/* Header */}
        <EditorHeader />

        {/* Main content area with sidebar and canvas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <EditorSidebar />

          {/* Canvas Area */}
          <NodeCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
