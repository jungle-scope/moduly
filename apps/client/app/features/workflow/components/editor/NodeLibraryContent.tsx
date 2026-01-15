'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { nodeRegistry, NodeDefinition } from '../../config/nodeRegistry';
import { useWorkflowStore } from '../../store/useWorkflowStore';

interface NodeLibraryContentProps {
  onDragStart?: (
    event: React.DragEvent,
    nodeType: string,
    nodeDef: NodeDefinition,
  ) => void;
  onSelect?: (nodeType: string, nodeDef: NodeDefinition) => void;
  hoveredNode?: string | null;
  onHoverNode?: (
    nodeId: string | null,
    node: any,
    event: React.MouseEvent,
  ) => void;
  disabledNodeTypes?: string[];
}

// 탭 정의 (이미지와 유사하게 구성)
const TABS = [
  { id: 'nodes', label: '노드' },
  { id: 'tools', label: '도구' },
  { id: 'start', label: '시작' },
] as const;

export const NodeLibraryContent = ({
  onDragStart,
  onSelect,
  hoveredNode,
  onHoverNode,
  disabledNodeTypes = [],
}: NodeLibraryContentProps) => {
  // 노드 개수 확인하여 초기 탭 결정
  // 처음 생성 시: 시작 노드 1개만 존재 -> 'start' 탭
  // 이후: 노드가 2개 이상이거나 시작 노드가 아닌 경우 -> 'nodes' 탭
  const nodes = useWorkflowStore((state) => state.nodes);
  const isInitialState =
    nodes.length === 1 &&
    (nodes[0].type === 'startNode' ||
      nodes[0].type === 'webhookTrigger' ||
      nodes[0].type === 'scheduleTrigger');
  const initialTab = isInitialState ? 'start' : 'nodes';

  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]['id']>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // 탭에 따른 카테고리 필터링
  const getFilteredCategories = () => {
    switch (activeTab) {
      case 'start':
        return ['trigger'];
      case 'tools':
        return ['plugin', 'workflow'];
      case 'nodes':
      default:
        return ['llm', 'logic', 'data', 'database'];
    }
  };

  // 노드 필터링 로직
  const filteredNodes = nodeRegistry.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;

    const matchesTab = getFilteredCategories().includes(node.category);

    return matchesSearch && matchesTab && node.implemented;
  });

  // 노드 비활성화 체크
  const isNodeDisabled = (nodeType: string) => {
    return disabledNodeTypes.includes(nodeType);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white select-none">
      {/* 1. Tabs */}
      <div className="flex items-center px-4 pt-4 pb-2 border-b border-gray-100">
        <div className="w-full grid grid-cols-3 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm font-medium pb-2 relative transition-colors w-full flex justify-center ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="검색 노드"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-9 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* 3. Node List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <p className="text-sm">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNodes.map((node) => (
              <div
                key={node.id}
                draggable={!!onDragStart && !isNodeDisabled(node.type)}
                onDragStart={(e) => {
                  if (!isNodeDisabled(node.type)) {
                    onDragStart?.(e, node.type, node);
                  }
                }}
                onClick={() => {
                  if (!isNodeDisabled(node.type)) {
                    onSelect?.(node.type, node);
                  }
                }}
                onMouseEnter={(e) => onHoverNode?.(node.id, node, e)}
                onMouseLeave={(e) => onHoverNode?.(null, null, e)}
                className={`group flex items-center gap-3 p-2 rounded-lg transition-all ${
                  isNodeDisabled(node.type)
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-gray-100/80 active:scale-[0.98]'
                } ${
                  hoveredNode === node.id && !isNodeDisabled(node.type)
                    ? 'bg-gray-100'
                    : ''
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-white transition-transform group-hover:scale-105"
                  style={{ backgroundColor: node.color }}
                >
                  {node.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {node.name}
                  </div>
                  {/* Description is hidden in list, shown in hover card usually */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
