'use client';

import { ReactFlowProvider } from '@xyflow/react';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import EditorSidebar from '@/app/features/workflow/components/editor/EditorSidebar';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';

// ReactFlowProvider 컨텍스트 내에서 자동 저장 로직을 관리하는 래퍼 컴포넌트
function WorkflowEditor() {
  const { triggerSave } = useAutoSync();

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <EditorHeader />

      {/* Main content area with sidebar and canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <EditorSidebar />

        {/* Canvas Area */}
        <NodeCanvas onViewportChange={triggerSave} />
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
