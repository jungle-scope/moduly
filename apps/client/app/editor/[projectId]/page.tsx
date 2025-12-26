'use client';

import { ReactFlowProvider } from 'reactflow';
import EditorHeader from '@/components/editor/EditorHeader';
import EditorSidebar from '@/components/editor/EditorSidebar';
import NodeCanvas from '@/components/editor/NodeCanvas';
import { useEditorStore } from '@/store/editorStore';

export default function EditorPage() {
  const { isFullscreen } = useEditorStore();

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-white">
        {/* Header */}
        {!isFullscreen && <EditorHeader />}

        {/* Main content area with sidebar and canvas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          {!isFullscreen && <EditorSidebar />}

          {/* Canvas Area */}
          <NodeCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
