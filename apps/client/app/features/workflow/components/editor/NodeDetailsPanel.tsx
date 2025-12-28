import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { getNodeDefinitionByType } from '../../config/nodeRegistry';

interface NodeDetailsPanelProps {
  nodeId: string | null;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * NodeDetailsPanel
 * 노드 선택 시 우측에 나타나는 세부 설정 패널
 */
export default function NodeDetailsPanel({
  nodeId,
  onClose,
  children,
}: NodeDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { nodes } = useWorkflowStore();

  // Find the selected node
  const selectedNode = nodes.find((n) => n.id === nodeId);
  // Find the node definition (for icon, description, etc.)
  const nodeDef = selectedNode
    ? getNodeDefinitionByType(selectedNode.type || '')
    : null;

  // Close panel when clicking outside (on canvas)
  useEffect(() => {
    if (!nodeId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't close if clicking inside the panel
      if (panelRef.current?.contains(target)) {
        return;
      }

      // Don't close if clicking on a node (let the node click handler manage it)
      if (target.closest('.react-flow__node')) {
        return;
      }

      // Don't close if clicking on bottom panel or other UI elements
      if (target.closest('.pointer-events-auto')) {
        return;
      }

      // Close the panel for canvas clicks
      if (target.closest('.react-flow__pane')) {
        onClose();
      }
    };

    // Add slight delay to prevent immediate closure when opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [nodeId, onClose]);

  if (!nodeId || !selectedNode) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded text-white font-bold text-sm ${nodeDef?.color || 'bg-gray-500'}`}
          >
            {nodeDef?.icon || '📦'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedNode.data.title || nodeDef?.name || 'Node'}
            </h2>
            <p className="text-xs text-gray-500">
              {nodeDef?.description || 'No description available.'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Panel Content - Currently showing children, which are usually empty in current usage */}
      {/* Future: Add specific property editors here based on node type */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}

        {/* Fallback content if no children */}
        {!children && (
          <div className="text-sm text-gray-500">
            Configure this node in the canvas or add property controls here.
          </div>
        )}
      </div>
    </div>
  );
}
