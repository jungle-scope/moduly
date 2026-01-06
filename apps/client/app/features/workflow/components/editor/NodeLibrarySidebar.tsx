'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, SquarePen } from 'lucide-react';
import { getImplementedNodes, NodeDefinition } from '../../config/nodeRegistry';
import { AppIcon, appApi } from '../../../app/api/appApi';
import EditAppModal from '../../../app/components/edit-app-modal';
import { useWorkflowStore } from '../../store/useWorkflowStore';

interface NodeLibrarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddNode: (nodeDefId: string, position?: { x: number; y: number }) => void;
  workflowName: string;
  workflowIcon: AppIcon;
  workflowDescription: string;
}

export default function NodeLibrarySidebar({
  isOpen,
  onToggle,
  onAddNode,
  workflowName,
  workflowIcon,
  workflowDescription,
}: NodeLibrarySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const implementedNodes = useMemo(() => getImplementedNodes(), []);

  const { projectApp, setProjectInfo, setProjectApp } = useWorkflowStore();

  const handleEditSuccess = async () => {
    if (projectApp) {
      try {
        const updatedApp = await appApi.getApp(projectApp.id);
        setProjectInfo(
          updatedApp.name,
          updatedApp.icon,
          updatedApp.description,
        );
        setProjectApp(updatedApp);
      } catch (e) {
        toast.error('앱 정보를 새로고침하는데 실패했습니다.');
      }
    }
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return implementedNodes;

    const query = searchQuery.toLowerCase();
    return implementedNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query) ||
        node.category.toLowerCase().includes(query),
    );
  }, [searchQuery, implementedNodes]);

  // Group nodes by category
  const nodesByCategory = useMemo(() => {
    const groups = new Map<string, NodeDefinition[]>();
    filteredNodes.forEach((node) => {
      if (!groups.has(node.category)) {
        groups.set(node.category, []);
      }
      groups.get(node.category)!.push(node);
    });
    return groups;
  }, [filteredNodes]);

  const categoryNames: Record<string, string> = {
    trigger: '트리거',
    llm: 'LLM',
    plugin: '플러그인',
    workflow: '워크플로우',
    logic: '로직',
    database: '데이터베이스',
    data: '데이터',
  };

  const handleDragStart = (e: React.DragEvent, nodeDefId: string) => {
    e.dataTransfer.setData('application/reactflow', nodeDefId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeClick = (nodeDefId: string) => {
    onAddNode(nodeDefId);
  };

  // Get input variables from node definition
  const getNodeInputs = (node: NodeDefinition): string[] => {
    const defaultData = node.defaultData();
    const inputs: string[] = [];

    // Extract inputs based on node type
    if (defaultData.variables) {
      inputs.push(...defaultData.variables.map((v: any) => v.name || v));
    }
    if (defaultData.inputs) {
      inputs.push(...defaultData.inputs.map((i: any) => i.name || i));
    }
    if (defaultData.referenced_variables) {
      inputs.push(...defaultData.referenced_variables);
    }

    return inputs;
  };

  return (
    <div
      className={`relative h-full bg-gradient-to-b from-blue-50 via-white to-blue-50/30 border-r border-gray-200 shadow-lg transition-all duration-300 ease-in-out ${
        isOpen ? 'w-80' : 'w-16'
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Toggle Button - shows on sidebar hover */}
      {isOpen && (
        <div className="absolute -right-3 top-4">
          {/* Moved below to between header and search */}
        </div>
      )}

      {/* Expand Button - for collapsed state */}
      {!isOpen && (
        <div className="absolute -right-3" style={{ top: '88px' }}>
          <button
            onClick={onToggle}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`relative flex items-center justify-center w-6 h-6 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-all ${
              isHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="사이드바 확장"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />

            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                사이드바 확장
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* Collapsed State - Icon Only */}
      {!isOpen && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center border border-white"
            style={{ backgroundColor: workflowIcon.background_color }}
          >
            <span className="text-white text-lg">{workflowIcon.content}</span>
          </div>
        </div>
      )}

      {/* Expanded Sidebar Content */}
      {isOpen && (
        <div className="h-full flex flex-col transition-opacity duration-300">
          {/* Header - Workflow Info */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-start gap-3">
              {/* Workflow Icon */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border border-white"
                style={{ backgroundColor: workflowIcon.background_color }}
              >
                <span className="text-white text-2xl">
                  {workflowIcon.content}
                </span>
              </div>

              {/* Workflow Name and Description */}
              <div className="flex-1 min-w-0 relative group/header h-full">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {workflowName}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {workflowDescription}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditModalOpen(true);
                  }}
                  className="absolute bottom-0 right-0 p-1 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50 opacity-0 group-hover/header:opacity-100 transition-all"
                  title="앱 정보 수정"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Edit App Modal */}
          {isEditModalOpen && projectApp && (
            <EditAppModal
              app={projectApp}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={handleEditSuccess}
            />
          )}

          {/* Toggle Button - between header and search */}
          <div className="relative px-4">
            <div className="absolute -right-3 top-0">
              <button
                onClick={onToggle}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`relative flex items-center justify-center w-6 h-6 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-all ${
                  isHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-label="사이드바 축소"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />

                {/* Tooltip */}
                {showTooltip && (
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                    사이드바 축소
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="노드 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 bg-white rounded-lg text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Node List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {Array.from(nodesByCategory.entries()).map(([category, nodes]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {categoryNames[category] || category}
                </h3>
                <div className="space-y-2">
                  {nodes.map((node) => {
                    const inputs = getNodeInputs(node);
                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node.id)}
                        onClick={() => handleNodeClick(node.id)}
                        className="group p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg cursor-move transition-all hover:shadow-md"
                      >
                        {/* Node Header */}
                        <div className="flex items-start gap-3 mb-2">
                          {/* Icon */}
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: node.color }}
                          >
                            {typeof node.icon === 'string' ? (
                              <span className="text-lg">{node.icon}</span>
                            ) : (
                              node.icon
                            )}
                          </div>

                          {/* Name and Description */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {node.name}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                              {node.description}
                            </p>
                          </div>
                        </div>

                        {/* Inputs */}
                        {inputs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-400 mb-1">
                              필요 변수:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inputs.slice(0, 3).map((input, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                                >
                                  {input}
                                </span>
                              ))}
                              {inputs.length > 3 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  +{inputs.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Drag hint */}
                        <div className="mt-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          드래그하거나 클릭하여 추가
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Empty State */}
            {filteredNodes.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
