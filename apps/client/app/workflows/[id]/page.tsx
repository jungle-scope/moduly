'use client';

import { ReactFlowProvider } from '@xyflow/react';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import EditorSidebar from '@/app/features/workflow/components/editor/EditorSidebar';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';

// WorkflowEditor: ReactFlowProvider 내부에서 자동 저장 관리
function WorkflowEditor() {
  // Provider 내부에서 안전하게 useAutoSync 호출
  useAutoSync();

  return (
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
  );
}

export default function WorkflowPage() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}
