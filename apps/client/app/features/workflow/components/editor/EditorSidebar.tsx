'use client';

import { useCallback, useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { nodeRegistry, type NodeDefinition } from '../../config/nodeRegistry';
import { SearchIcon, ChevronRightIcon } from '../icons';

// Category display names
const categoryDisplayNames: Record<string, string> = {
  trigger: 'Trigger',
  llm: 'LLM',
  plugin: 'Plugin',
  workflow: 'Workflow',
  logic: 'Logic',
  database: 'Database',
  data: 'Data',
};

export default function EditorSidebar() {
  const { nodes, setNodes } = useWorkflowStore();
  const { getViewport } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingNode, setDraggingNode] = useState<NodeDefinition | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // Filter nodes based on search
  const filteredNodes = nodeRegistry.filter((node) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      node.name.toLowerCase().includes(query) ||
      node.category.toLowerCase().includes(query) ||
      node.description?.toLowerCase().includes(query)
    );
  });

  // Group nodes by category
  const nodesByCategory = filteredNodes.reduce(
    (acc, node) => {
      if (!acc[node.category]) {
        acc[node.category] = [];
      }
      acc[node.category].push(node);
      return acc;
    },
    {} as Record<string, NodeDefinition[]>,
  );

  // Handle node click - add to canvas
  const handleNodeClick = useCallback(
    (nodeDef: NodeDefinition) => {
      // Check if node is implemented
      if (!nodeDef.implemented) {
        toast.error(`${nodeDef.name} is not yet implemented`);
        return;
      }

      // Check for uniqueness constraint
      if (nodeDef.unique) {
        const existingNode = nodes.find((node) => node.type === nodeDef.type);
        if (existingNode) {
          toast.warning(
            `Only one ${nodeDef.name} node is allowed per workflow`,
          );
          return;
        }
      }

      // Calculate center of viewport
      const viewport = getViewport();
      const reactFlowWrapper = document.querySelector('.react-flow');
      let position = { x: 0, y: 0 };

      if (reactFlowWrapper) {
        const { width, height } = reactFlowWrapper.getBoundingClientRect();
        position = {
          x: (-viewport.x + width / 2) / viewport.zoom - 75,
          y: (-viewport.y + height / 2) / viewport.zoom - 40,
        };
      }

      // Create new node
      const newNode = {
        id: `${nodeDef.id}-${Date.now()}`,
        type: nodeDef.type,
        data: nodeDef.defaultData(),
        position,
      };

      setNodes([...nodes, newNode] as unknown as any[]);
      toast.success(`${nodeDef.name} node added`);
    },
    [nodes, getViewport, setNodes],
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent, nodeDef: NodeDefinition) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/reactflow', nodeDef.type);
      e.dataTransfer.setData('nodeDefId', nodeDef.id);
      setDraggingNode(nodeDef);
    },
    [],
  );

  // Track mouse position during drag
  useEffect(() => {
    if (!draggingNode) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setDraggingNode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNode]);

  return (
    <>
      <aside className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Node Library
          </h2>

          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in this library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(nodesByCategory).map(([category, categoryNodes]) => (
            <div key={category} className="border-b border-gray-200">
              {/* Category Header */}
              <div className="px-4 py-2 bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {categoryDisplayNames[category] || category}
                </h3>
              </div>

              {/* Node Items */}
              <div className="divide-y divide-gray-100">
                {categoryNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    onDragStart={(e) => handleDragStart(e, node)}
                    draggable={node.implemented}
                    disabled={!node.implemented}
                    className={`
                      w-full px-4 py-3 flex items-center gap-3 transition-colors
                      ${
                        node.implemented
                          ? 'hover:bg-gray-50 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    {/* Node Icon Preview */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200"
                      style={{
                        backgroundColor: node.color.startsWith('bg-')
                          ? '#f3f4f6'
                          : `${node.color}10`,
                      }}
                    >
                      <span className="text-2xl">{node.icon}</span>
                    </div>

                    {/* Node Info */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {node.name}
                        </h4>
                        {!node.implemented && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                            Soon
                          </span>
                        )}
                      </div>
                      {node.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                          {node.description}
                        </p>
                      )}
                    </div>

                    {/* Chevron */}
                    <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {filteredNodes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-sm text-gray-500 text-center">
                No nodes found
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                Try a different search term
              </p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''} •{' '}
            {filteredNodes.filter((n) => n.implemented).length} available
          </div>
        </div>
      </aside>

      {/* Cursor-following drag preview - matches actual node design */}
      {draggingNode && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragPosition.x + 10,
            top: dragPosition.y + 10,
          }}
        >
          {/* Preview matching actual node design */}
          <div className="relative bg-white rounded-lg border-2 border-blue-500 px-4 py-3 shadow-2xl min-w-[200px] opacity-90">
            <div className="flex items-center gap-3">
              {/* Icon matching node style */}
              <div
                className="flex items-center justify-center w-8 h-8 rounded text-white font-bold text-sm"
                style={{
                  backgroundColor: draggingNode.color.startsWith('bg-')
                    ? '#3b82f6' // default blue
                    : draggingNode.color,
                }}
              >
                {draggingNode.icon}
              </div>

              {/* Text Content */}
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-gray-900">
                  {draggingNode.name}
                </div>
                <div className="text-xs text-gray-500">
                  {draggingNode.category}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
