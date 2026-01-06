'use client';

import { ReactFlowProvider } from '@xyflow/react';
import Header from '@/app/features/dashboard/components/Header';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';
import { useWorkflowAppSync } from '@/app/features/workflow/hooks/useWorkflowAppSync';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

// ReactFlowProvider 컨텍스트 내에서 자동 저장 로직을 관리하는 래퍼 컴포넌트
function WorkflowEditor() {
  useAutoSync();
  useWorkflowAppSync();
  const { isFullscreen } = useWorkflowStore();

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Global Header */}
      <div className={isFullscreen ? 'hidden' : 'block'}>
        <Header />
      </div>

      {/* 헤더 (Toolbar) */}
      <EditorHeader />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 캔버스 영역 */}
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
