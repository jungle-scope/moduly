'use client';

import { type NodeDefinition } from '../../config/nodeRegistry';

interface NodeCardProps {
  node: NodeDefinition;
  onClick: () => void;
  onDragStart: (node: NodeDefinition) => void;
}

export default function NodeCard({
  node,
  onClick,
  onDragStart,
}: NodeCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/reactflow', node.type);
    e.dataTransfer.setData('nodeDefId', node.id);
    onDragStart(node);
  };

  return (
    <div
      draggable={node.implemented}
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`
        group relative rounded-lg border-2 transition-all duration-200
        ${
          node.implemented
            ? 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer bg-white'
            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
        }
      `}
      title={node.implemented ? node.description : '아직 구현되지 않았습니다'}
    >
      {/* Card Content */}
      <div className="p-4 flex flex-col items-center gap-3">
        {/* Icon */}
        <div
          className={`
            w-12 h-12 rounded-lg flex items-center justify-center text-2xl
            transition-transform duration-200
            ${node.implemented ? 'group-hover:scale-110' : ''}
          `}
          style={{
            backgroundColor: node.color.startsWith('bg-')
              ? undefined
              : `${node.color}20`,
          }}
        >
          {node.icon}
        </div>

        {/* Name */}
        <div className="text-center">
          <div
            className={`
            text-sm font-medium
            ${node.implemented ? 'text-gray-700' : 'text-gray-400'}
          `}
          >
            {node.name}
          </div>
        </div>

        {/* Category Badge */}
        <div
          className={`
          px-2 py-0.5 rounded-full text-xs font-medium
          ${
            node.implemented
              ? 'bg-gray-100 text-gray-600'
              : 'bg-gray-50 text-gray-400'
          }
        `}
        >
          {node.category}
        </div>
      </div>

      {/* Hover Indicator for Drag */}
      {node.implemented && (
        <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-blue-400 pointer-events-none transition-all" />
      )}

      {/* Not Implemented Badge */}
      {!node.implemented && (
        <div className="absolute top-2 right-2">
          <div className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
            Soon
          </div>
        </div>
      )}
    </div>
  );
}
