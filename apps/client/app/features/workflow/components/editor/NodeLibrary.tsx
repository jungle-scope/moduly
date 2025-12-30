'use client';

import { useState, useMemo } from 'react';
import { SearchIcon } from '../icons';
import { nodeRegistry, type NodeDefinition } from '../../config/nodeRegistry';
import NodeCard from './NodeCard';

interface NodeLibraryProps {
  onNodeAdd: (node: NodeDefinition) => void;
  onDragStart: (node: NodeDefinition) => void;
}

// Category display names
const categoryDisplayNames: Record<string, string> = {
  trigger: '🎯 Trigger',
  llm: '🤖 LLM',
  plugin: '🔌 Plugin',
  workflow: '🔄 Workflow',
  logic: '⚡ Logic',
  database: '💾 Database',
  data: '📊 Data',
};

export default function NodeLibrary({
  onNodeAdd,
  onDragStart,
}: NodeLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return nodeRegistry;
    }

    const query = searchQuery.toLowerCase();
    return nodeRegistry.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.category.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Group filtered nodes by category
  const nodesByCategory = useMemo(() => {
    const categories = new Map<string, NodeDefinition[]>();

    filteredNodes.forEach((node) => {
      const category = node.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(node);
    });

    return categories;
  }, [filteredNodes]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Node Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {nodesByCategory.size === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-500 text-sm">No nodes found</p>
            <p className="text-gray-400 text-xs mt-1">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(nodesByCategory.entries()).map(
              ([categoryKey, categoryNodes]) => (
                <div key={categoryKey}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {categoryDisplayNames[categoryKey] || categoryKey}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">
                      {categoryNodes.length}
                    </span>
                  </div>

                  {/* Node Cards Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {categoryNodes.map((node) => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        onClick={() => onNodeAdd(node)}
                        onDragStart={onDragStart}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''}
          </span>
          <span>
            {filteredNodes.filter((n) => n.implemented).length} available
          </span>
        </div>
      </div>
    </div>
  );
}
