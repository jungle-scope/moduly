'use client';

import { ReactFlowProvider } from '@xyflow/react';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';
import { useWorkflowAppSync } from '@/app/features/workflow/hooks/useWorkflowAppSync';
import EditorViewSwitcher, {
  ViewMode,
} from '@/app/features/workflow/components/editor/EditorViewSwitcher';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// ReactFlowProvider 컨텍스트 내에서 자동 저장 로직을 관리하는 래퍼 컴포넌트
function WorkflowEditor() {
  useAutoSync();
  useWorkflowAppSync();
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam === 'logs') {
      setViewMode('log');
    } else if (tabParam === 'monitoring') {
      setViewMode('monitoring');
    } else {
      setViewMode('edit');
    }
  }, [tabParam]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 (Toolbar) */}
      <EditorHeader />

      <EditorViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 캔버스 영역 */}
        <NodeCanvas viewMode={viewMode} onViewModeChange={setViewMode} />
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
