'use client';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { NetworkIcon } from '../icons';

export default function WorkflowTabs() {
  const { workflows, activeWorkflowId, setActiveWorkflow } = useWorkflowStore();

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-200 overflow-x-auto">
      {workflows.map((workflow) => (
        <button
          key={workflow.id}
          onClick={() => setActiveWorkflow(workflow.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            workflow.id === activeWorkflowId
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <NetworkIcon className="w-4 h-4" />
          <span>{workflow.name}</span>
        </button>
      ))}
    </div>
  );
}
