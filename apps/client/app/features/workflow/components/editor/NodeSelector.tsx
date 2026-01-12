'use client';

import { useState } from 'react';
import { NodeLibraryContent } from './NodeLibraryContent';
import { NodeDefinition } from '../../config/nodeRegistry';

interface NodeSelectorProps {
  onSelect: (type: string, nodeDef: NodeDefinition) => void;
}

const categoryNames: Record<string, string> = {
  trigger: '시작',
  llm: '질문 이해',
  plugin: '도구',
  workflow: '변환',
  logic: '논리',
};

export const NodeSelector = ({ onSelect }: NodeSelectorProps) => {
  const [hoveredNode, setHoveredNode] = useState<NodeDefinition | null>(null);

  const handleHoverNode = (
    nodeId: string | null,
    node: any,
    event: React.MouseEvent,
  ) => {
    if (node) {
      setHoveredNode(node);
    } else {
      setHoveredNode(null);
    }
  };

  return (
    <div className="relative flex">
      <div className="w-[220px] h-[400px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
        {/* Reusing the exact content from sidebar */}
        <NodeLibraryContent
          onSelect={(_type, def) => onSelect(def.id, def)}
          hoveredNode={hoveredNode?.id}
          onHoverNode={handleHoverNode}
        />
      </div>

      {/* Hover Card (Popover) - Positioned to the right of the selector */}
      {hoveredNode && (
        <div className="absolute left-full ml-3 top-0 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 transition-all duration-200 animate-in fade-in slide-in-from-left-2 z-50">
          <div className="flex items-start gap-3 mb-2">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: hoveredNode.color }}
            >
              <div className="text-white flex items-center justify-center">
                {hoveredNode.icon}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{hoveredNode.name}</h3>
              <p className="text-xs text-gray-500 font-medium">
                {categoryNames[hoveredNode.category]}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {hoveredNode.description}
          </p>
        </div>
      )}
    </div>
  );
};
