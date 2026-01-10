'use client';

import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getImplementedNodes, NodeDefinition } from '../../config/nodeRegistry';
import { JigsawBackground } from '../nodes/BaseNode';

interface NodeLibrarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddNode: (nodeDefId: string, position?: { x: number; y: number }) => void;
  onOpenAppSearch: () => void;
}

type TabType = 'nodes' | 'tools' | 'start';

const TABS: { id: TabType; label: string }[] = [
  { id: 'nodes', label: '노드' },
  { id: 'tools', label: '도구' },
  { id: 'start', label: '시작' },
];

const NODE_TABS: Record<TabType, string[]> = {
  // 시작: 입력, 웹훅 트리거, 알람 트리거
  start: ['start', 'webhook-trigger', 'schedule-trigger'],
  // 노드: LLM, 응답, 코드 실행, IF/ELSE, PDF 텍스트 추출, 템플릿, HTTP 요청
  nodes: [
    'llm',
    'file-extraction',
    'answer',
    'code',
    'condition',
    'template',
    'http',
  ],
  // 도구: 서브 모듈, slack, github, 메일 검색
  tools: ['workflow', 'slack-post', 'github', 'mail'],
};

export default function NodeLibrarySidebar({
  isOpen,
  onToggle,
  onAddNode,
  onOpenAppSearch,
}: NodeLibrarySidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('nodes');
  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<{
    def: NodeDefinition;
    top: number;
  } | null>(null);

  // Drag Preview State
  const [previewNode, setPreviewNode] = useState<NodeDefinition | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const implementedNodes = useMemo(() => getImplementedNodes(), []);

  const categoryNames: Record<string, string> = {
    trigger: '트리거',
    llm: 'LLM',
    plugin: '플러그인',
    workflow: '서브 모듈',
    logic: '로직',
    database: '데이터베이스',
    data: '데이터',
  };

  const handleDragStart = (e: React.DragEvent, nodeDefId: string) => {
    e.dataTransfer.setData('application/reactflow', nodeDefId);
    e.dataTransfer.effectAllowed = 'move';

    // Set custom drag image
    if (previewRef.current) {
      // Adjust offset to center the preview under cursor roughly
      e.dataTransfer.setDragImage(previewRef.current, 160, 40);
    }
  };

  const handleNodeClick = (nodeDefId: string) => {
    const nodeDef = implementedNodes.find((n) => n.id === nodeDefId);
    if (nodeDef?.type === 'workflowNode') {
      onOpenAppSearch();
    } else {
      onAddNode(nodeDefId);
    }
  };

  const filteredNodes = useMemo(() => {
    const targetIds = NODE_TABS[activeTab] || [];
    return implementedNodes
      .filter((node) => targetIds.includes(node.id))
      .filter((node) =>
        node.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [implementedNodes, activeTab, searchQuery]);

  return (
    <div
      ref={sidebarRef}
      className={`relative h-full bg-transparent transition-all duration-300 ease-in-out z-20 ${
        isOpen ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Hidden Drag Preview Node */}
      <div
        ref={previewRef}
        className="absolute top-[-9999px] left-[-9999px] pointer-events-none"
        style={{ width: 320, height: 120 }}
      >
        {previewNode && (
          <div className="relative w-full h-full p-7">
            <JigsawBackground
              width={320}
              height={120}
              shapes={{
                top: 'flat',
                right: 'flat',
                bottom: 'flat',
                left: 'flat',
              }}
              status="idle"
            />
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: previewNode.color }}
                >
                  {typeof previewNode.icon === 'string' ? (
                    <span className="text-xl">{previewNode.icon}</span>
                  ) : (
                    previewNode.icon && (
                      <div className="w-7 h-7">{previewNode.icon}</div>
                    )
                  )}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 leading-none mb-1">
                    {previewNode.name}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isOpen ? (
        <div className="h-full w-full rounded-xl overflow-hidden">
          <div className="flex flex-col h-full bg-gray-50/30">
            {/* 1. Tabs */}
            <div className="flex w-full items-center bg-gray-50 p-1 rounded-t-xl">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors rounded-md ${
                    activeTab === tab.id
                      ? 'text-blue-600 bg-white'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 2. Search & Header Info */}
            <div className="px-4 py-3 border-b border-gray-100 bg-white">
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="검색 노드"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* 3. Node List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 rounded-b-xl">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={(e) => {
                    setPreviewNode(node); // For Drag Preview
                    if (sidebarRef.current) {
                      const sidebarRect =
                        sidebarRef.current.getBoundingClientRect();
                      const itemRect = e.currentTarget.getBoundingClientRect();
                      // Calculate top relative to sidebar (adjusting for header offset if needed, but rect-rect should be fine)
                      const relativeTop = itemRect.top - sidebarRect.top;
                      setHoveredNode({ def: node, top: relativeTop });
                    }
                  }}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="group flex items-center gap-3 p-2 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: node.color }}
                  >
                    {typeof node.icon === 'string' ? (
                      <span className="text-white text-lg font-bold flex items-center justify-center h-full pb-0.5">
                        {node.icon}
                      </span>
                    ) : (
                      <div className="text-white w-5 h-5 flex items-center justify-center">
                        {node.icon}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {node.name}
                  </span>
                </div>
              ))}

              {filteredNodes.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Hover Card (Popover) - Dynamic Positioning */}
      {hoveredNode && isOpen && (
        <div
          className="absolute left-[266px] z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 transition-all duration-200 animate-in fade-in slide-in-from-left-2"
          style={{ top: hoveredNode.top }}
        >
          <div className="flex items-start gap-3 mb-2">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: hoveredNode.def.color }}
            >
              {typeof hoveredNode.def.icon === 'string' ? (
                <span className="text-white text-lg font-bold flex items-center justify-center h-full pb-0.5">
                  {hoveredNode.def.icon}
                </span>
              ) : (
                <div className="text-white w-5 h-5 flex items-center justify-center">
                  {hoveredNode.def.icon}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                {hoveredNode.def.name}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {categoryNames[hoveredNode.def.category]}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {hoveredNode.def.description}
          </p>
        </div>
      )}
    </div>
  );
}
