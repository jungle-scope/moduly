'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import NodeCanvas from '@/app/features/workflow/components/editor/NodeCanvas';
import { useAutoSync } from '@/app/features/workflow/hooks/useAutoSync';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

// Workflow section component
function WorkflowContent() {
  const params = useParams();
  const id = params.id as string;
  const setActiveWorkflow = useWorkflowStore(
    (state) => state.setActiveWorkflow,
  );
  const prevIdRef = useRef<string | undefined>(undefined);

  // Load workflow when URL parameter changes
  useEffect(() => {
    if (id && id !== prevIdRef.current) {
      setActiveWorkflow(id);
      prevIdRef.current = id;
    }
  }, [id, setActiveWorkflow]);

  useAutoSync(); // Auto-save workflow changes to server
  return <NodeCanvas key={id} />; // Key forces remount when workflow changes
}

// Plugin section placeholder
function PluginContent() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          Plugin Management
        </h2>
        <p className="text-gray-500">Coming soon...</p>
      </div>
    </div>
  );
}

// Data section placeholder
function DataContent() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          Data Management
        </h2>
        <p className="text-gray-500">Coming soon...</p>
      </div>
    </div>
  );
}

export default function AppSectionPage() {
  const params = useParams();
  const section = params.section as string;
  const id = params.id as string;

  // Render content based on section
  switch (section) {
    case 'workflow':
      return <WorkflowContent key={id} />;
    case 'plugin':
      return <PluginContent key={id} />;
    case 'data':
      return <DataContent key={id} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Invalid section: {section}</p>
        </div>
      );
  }
}
