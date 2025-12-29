'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  NetworkIcon,
  PluginIcon,
  DatabaseIcon,
} from '@/app/features/workflow/components/icons';

interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children?: React.ReactNode;
}

function SidebarSection({
  title,
  icon,
  isCollapsed,
  onToggle,
  onAdd,
  children,
}: SidebarSectionProps) {
  return (
    <div className="border-b border-gray-200">
      <div
        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <button className="p-0.5">
            {isCollapsed ? (
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <div className="text-gray-600">{icon}</div>
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label={`Add ${title}`}
        >
          <PlusIcon className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {!isCollapsed && children && (
        <div className="px-3 py-2 bg-gray-50">{children}</div>
      )}
    </div>
  );
}

export default function EditorSidebar() {
  const params = useParams();
  const workflowId = params.id as string; // URL에서 workflow_id 추출

  const {
    workflows,
    activeWorkflowId,
    setActiveWorkflow,
    addWorkflow,
    sidebarCollapsed,
    toggleSidebarSection,
    activeConfigTab,
    setActiveConfigTab,
  } = useWorkflowStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [currentAppId, setCurrentAppId] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Load current workflow's app_id from backend
  useEffect(() => {
    const loadWorkflowAppId = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/v1/workflows/${workflowId}`,
          {
            credentials: 'include',
          },
        );
        if (response.ok) {
          const data = await response.json();
          // Extract app_id from workflow
          if (data.app_id) {
            setCurrentAppId(data.app_id);
          }
        }
      } catch (error) {
        console.error('Failed to load workflow app_id:', error);
      }
    };

    if (workflowId) {
      loadWorkflowAppId();
    }
  }, [workflowId]);

  // Use loaded app_id or fallback to workflow_id temporarily
  const appId = currentAppId || workflowId;

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showCreateModal &&
        modalRef.current &&
        !modalRef.current.contains(event.target as HTMLElement)
      ) {
        setShowCreateModal(false);
      }
    };

    if (showCreateModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showCreateModal && modalInputRef.current) {
      // Auto-focus on modal input when opened
      const timeoutId = setTimeout(() => {
        modalInputRef.current?.focus();
      }, 100);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [showCreateModal]);

  const handleAddWorkflow = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCreateWorkflow = useCallback(async () => {
    if (workflowName.trim()) {
      try {
        await addWorkflow(
          {
            name: workflowName,
            description: workflowDescription,
            icon: '🔄', // Default icon
            nodes: [],
            edges: [],
          },
          appId, // workflow ID를 app_id로 사용 (임시)
        );
        setWorkflowName('');
        setWorkflowDescription('');
        setShowCreateModal(false);
      } catch (error) {
        console.error('Failed to create workflow:', error);
        // TODO: Show error message to user
      }
    }
  }, [workflowName, workflowDescription, addWorkflow, appId]);

  const handleCancelCreate = useCallback(() => {
    setWorkflowName('');
    setWorkflowDescription('');
    setShowCreateModal(false);
  }, []);

  const handleAddPlugin = useCallback(() => {
    // TODO: Implement add plugin functionality
  }, []);

  const handleAddData = useCallback(() => {
    // TODO: Implement add data functionality
  }, []);

  return (
    <>
      <aside className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Workflow Section */}
          <SidebarSection
            title="Workflow"
            icon={<></>}
            isCollapsed={sidebarCollapsed.workflow}
            onToggle={() => toggleSidebarSection('workflow')}
            onAdd={handleAddWorkflow}
          >
            <div className="space-y-1">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => setActiveWorkflow(workflow.id)}
                  className={`px-3 py-1.5 text-sm rounded cursor-pointer flex items-center gap-2 ${
                    workflow.id === activeWorkflowId
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <NetworkIcon className="w-4 h-4" />
                  <span>{workflow.name}</span>
                </div>
              ))}
            </div>
          </SidebarSection>

          {/* Plugin Section */}
          <SidebarSection
            title="Plugin"
            icon={<PluginIcon className="w-4 h-4" />}
            isCollapsed={sidebarCollapsed.plugin}
            onToggle={() => toggleSidebarSection('plugin')}
            onAdd={handleAddPlugin}
          >
            <div className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer flex items-center gap-2">
              <PluginIcon className="w-4 h-4" />
              <span>test</span>
            </div>
          </SidebarSection>

          {/* Data Section */}
          <SidebarSection
            title="Data"
            icon={<DatabaseIcon className="w-4 h-4" />}
            isCollapsed={sidebarCollapsed.data}
            onToggle={() => toggleSidebarSection('data')}
            onAdd={handleAddData}
          >
            <div className="text-xs text-gray-500 text-center py-4">
              Data has not been added yet
            </div>
          </SidebarSection>

          {/* Configuration Section */}
          <div className="border-b border-gray-200">
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer"
              onClick={() => toggleSidebarSection('configuration')}
            >
              <div className="flex items-center gap-2">
                <button className="p-0.5">
                  {sidebarCollapsed.configuration ? (
                    <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Observability
                </span>
              </div>
            </div>

            {!sidebarCollapsed.configuration && (
              <div className="px-3 pb-3">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveConfigTab('logs')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      activeConfigTab === 'logs'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Logs
                  </button>
                  <button
                    onClick={() => setActiveConfigTab('monitoring')}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      activeConfigTab === 'monitoring'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Monitoring
                  </button>
                </div>

                <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
                  {activeConfigTab === 'logs' ? (
                    <p>로그 내용이 여기에 표시됩니다.</p>
                  ) : (
                    <p>모니터링 데이터가 여기에 표시됩니다.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-2xl w-[480px] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Create workflow
              </h2>
              <button
                onClick={handleCancelCreate}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Workflow Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>

            {/* Workflow Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Please enter a workflow name"
                maxLength={30}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {workflowName.length}/30
              </div>
            </div>

            {/* Workflow Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Please describe the calling scenarios for this workflow to help the LLM better understand it"
                maxLength={500}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {workflowDescription.length}/500
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelCreate}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!workflowName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
