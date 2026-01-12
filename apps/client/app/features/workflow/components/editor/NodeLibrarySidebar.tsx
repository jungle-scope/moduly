'use client';

import { flushSync } from 'react-dom';
import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { NodeLibraryContent } from './NodeLibraryContent';
import { NodeDefinition } from '../../config/nodeRegistry';
import { useWorkflowStore } from '../../store/useWorkflowStore';

interface NodeLibrarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  // Canvas handles the drag/drop logic, usually by listening to drag events on the window or canvas.
  // But here we need to set dataTransfer.
  onAddNode?: (type: string, position: { x: number; y: number }) => void; // Unused for drag, but kept for interface compat if needed
  onOpenAppSearch?: () => void;
}

const categoryNames: Record<string, string> = {
  trigger: '시작',
  llm: '질문 이해',
  plugin: '도구',
  workflow: '변환',
  logic: '논리',
};

export default function NodeLibrarySidebar({
  isOpen,
  onToggle,
  onOpenAppSearch,
  onAddNode,
}: NodeLibrarySidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // 시작 노드 개수 확인 및 비활성화 로직
  const startNodeCount = useWorkflowStore((state) => state.getStartNodeCount());
  const hasTriggerNode = startNodeCount > 0;
  const disabledNodeTypes = hasTriggerNode
    ? ['startNode', 'webhookTrigger', 'scheduleTrigger']
    : [];

  // Hover Card State
  const [hoveredNode, setHoveredNode] = useState<NodeDefinition | null>(null);
  const [hoveredNodePos, setHoveredNodePos] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  // Drag Preview State
  const [previewNode, setPreviewNode] = useState<NodeDefinition | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (
    event: React.DragEvent,
    nodeType: string,
    nodeDef: NodeDefinition,
  ) => {
    // Use nodeDef.id matches what NodeCanvas expects (getNodeDefinition(id))
    event.dataTransfer.setData('application/reactflow', nodeDef.id);
    event.dataTransfer.effectAllowed = 'move';

    // JSON payload for data (optional, but good for dropped node init)
    const initialData = nodeDef.defaultData();
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: nodeDef.type, data: initialData }),
    );

    // Use flushSync to render the React component immediately for drag image
    flushSync(() => {
      setPreviewNode(nodeDef);
    });

    if (previewRef.current) {
      event.dataTransfer.setDragImage(previewRef.current, 120, 36);
    }

    // Cleanup after drag starts
    setTimeout(() => {
      setPreviewNode(null);
    }, 0);
  };

  const handleHoverNode = (
    nodeId: string | null,
    node: any,
    event: React.MouseEvent,
  ) => {
    if (node && event) {
      const target = event.currentTarget as HTMLElement;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      setHoveredNode(node);
      setHoveredNodePos({ x: rect.right + 10, y: rect.top });
    } else {
      setHoveredNode(null);
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={`relative h-full bg-transparent transition-all duration-300 ease-in-out z-20 ${
        isOpen ? 'w-64' : 'w-12'
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Main Content Area */}
      <div
        className={`h-full bg-white flex flex-col transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        } overflow-hidden rounded-xl border-r border-gray-200`}
      >
        <NodeLibraryContent
          onDragStart={handleDragStart}
          onSelect={(type, def) => {
            onAddNode?.(def.id, { x: 100, y: 200 });
          }}
          hoveredNode={hoveredNode?.id}
          onHoverNode={handleHoverNode}
          disabledNodeTypes={disabledNodeTypes}
        />
      </div>

      {/* Toggle Button */}
      <div className="absolute -right-3 top-20 z-30">
        <button
          onClick={onToggle}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`flex items-center justify-center w-6 h-6 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-opacity ${
            isHovering || !isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
              {isOpen ? '사이드바 축소' : '사이드바 확장'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
            </div>
          )}
        </button>
      </div>

      {/* Hidden Drag Preview */}
      <div
        ref={previewRef}
        style={{
          position: 'absolute',
          top: -9999,
          left: -9999,
          // Styles matching the previous manual creation
          width: '240px',
          padding: '16px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          pointerEvents: 'none', // Ensure it doesn't interfere
          zIndex: -1,
        }}
      >
        {previewNode && (
          <>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: previewNode.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'white', // Ensure icon is white
              }}
            >
              {
                // Verify icon rendering. nodeDef.icon is ReactNode.
                // If it's a component, verify usage.
                // Usually <Icon />.
                previewNode.icon
              }
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#111827',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {previewNode.name}
            </div>
          </>
        )}
      </div>

      {/* Hover Card (Popover) - Fixed Position based on calculation */}
      {hoveredNode && isOpen && (
        <div
          className="fixed z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 transition-all duration-200 animate-in fade-in slide-in-from-left-2 pointer-events-none"
          style={{ left: hoveredNodePos.x, top: hoveredNodePos.y - 20 }}
        >
          <div className="flex items-start gap-3 mb-2">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: hoveredNode.color }}
            >
              {/* Icon rendering needs to be consistent. NodeDefinition icon is ReactNode | string */}
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
}
