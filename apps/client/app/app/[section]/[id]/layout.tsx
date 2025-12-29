'use client';

import { ReactFlowProvider } from '@xyflow/react';
import EditorHeader from '@/app/features/workflow/components/editor/EditorHeader';
import EditorSidebar from '@/app/features/workflow/components/editor/EditorSidebar';

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col">
        <EditorHeader />
        <div className="flex flex-1 overflow-hidden">
          <EditorSidebar />
          {children}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
