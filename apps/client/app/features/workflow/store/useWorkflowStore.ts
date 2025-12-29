import {
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import {
  Features,
  EnvironmentVariable,
  ConversationVariable,
  Node,
} from '../types/Workflow';

import { create } from 'zustand';
import { DEFAULT_NODES } from '../constants';
import { workflowApi } from '../api/workflowApi';

interface SidebarState {
  workflow: boolean;
  plugin: boolean;
  data: boolean;
  configuration: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

type WorkflowState = {
  // === Editor UI State (from editorStore) ===
  workflows: Workflow[];
  activeWorkflowId: string;
  sidebarCollapsed: SidebarState;
  activeConfigTab: 'logs' | 'monitoring';
  projectName: string;
  projectIcon: string;
  interactiveMode: 'mouse' | 'touchpad';
  isFullscreen: boolean;

  // === Graph Data ===
  nodes: Node[];
  edges: Edge[];

  // === Extra Fields (for API sync) ===
  features: Features;
  environmentVariables: EnvironmentVariable[];
  conversationVariables: ConversationVariable[];

  // === ReactFlow Actions ===
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // === Editor UI Actions ===
  toggleSidebarSection: (section: keyof SidebarState) => void;
  setActiveConfigTab: (tab: 'logs' | 'monitoring') => void;
  setProjectInfo: (name: string, icon: string) => void;
  setInteractiveMode: (mode: 'mouse' | 'touchpad') => void;
  toggleFullscreen: () => void;
  addWorkflow: (
    workflow: Omit<Workflow, 'id'>,
    appId: string,
  ) => Promise<string>;
  loadWorkflowsByApp: (appId: string) => Promise<void>;
  setActiveWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  updateWorkflowViewport: (
    id: string,
    viewport: { x: number; y: number; zoom: number },
  ) => void;

  // === API Sync Actions ===
  setFeatures: (features: Features) => void;
  setEnvironmentVariables: (vars: EnvironmentVariable[]) => void;
  setConversationVariables: (vars: ConversationVariable[]) => void;
  updateNodeData: (nodeId: string, newData: Record<string, unknown>) => void;
  setWorkflowData: (data: {
    nodes: Node[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
    features?: Features;
    environmentVariables?: EnvironmentVariable[];
    conversationVariables?: ConversationVariable[];
  }) => void;
};

// Initial data
const initialNodes: Node[] = DEFAULT_NODES;
const initialEdges: Edge[] = [];

const initialWorkflows: Workflow[] = [
  {
    id: 'default',
    name: 'Main Workflow',
    description: 'Default workflow',
    icon: '🔥',
    nodes: initialNodes,
    edges: initialEdges,
    viewport: { x: 0, y: 0, zoom: 1 },
  },
];

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // === Editor UI State ===
  workflows: initialWorkflows,
  activeWorkflowId: 'default',
  sidebarCollapsed: {
    workflow: false,
    plugin: true,
    data: true,
    configuration: false,
  },
  activeConfigTab: 'logs',
  projectName: 'My Project',
  projectIcon: '🔥',
  interactiveMode: 'mouse',
  isFullscreen: false,

  // === Graph Data ===
  nodes: initialNodes,
  edges: initialEdges,
  features: {},
  environmentVariables: [],
  conversationVariables: [],

  // === ReactFlow Actions ===
  setNodes: (nodes) => {
    const { workflows, activeWorkflowId } = get();
    const updatedWorkflows = workflows.map((w) =>
      w.id === activeWorkflowId ? { ...w, nodes } : w,
    );
    set({ nodes, workflows: updatedWorkflows });
  },

  setEdges: (edges) => {
    const { workflows, activeWorkflowId } = get();
    const updatedWorkflows = workflows.map((w) =>
      w.id === activeWorkflowId ? { ...w, edges } : w,
    );
    set({ edges, workflows: updatedWorkflows });
  },

  onNodesChange: (changes: NodeChange[]) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    get().setNodes(newNodes as Node[]);
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    get().setEdges(newEdges);
  },

  onConnect: (connection: Connection) => {
    const newEdges = addEdge(connection, get().edges);
    get().setEdges(newEdges);
  },

  // === Editor UI Actions ===
  toggleSidebarSection: (section) => {
    set((state) => ({
      sidebarCollapsed: {
        ...state.sidebarCollapsed,
        [section]: !state.sidebarCollapsed[section],
      },
    }));
  },

  setActiveConfigTab: (tab) => set({ activeConfigTab: tab }),

  setProjectInfo: (name, icon) => set({ projectName: name, projectIcon: icon }),

  setInteractiveMode: (mode) => set({ interactiveMode: mode }),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

  addWorkflow: async (workflow, appId) => {
    try {
      // Backend API 호출
      const created = await workflowApi.createWorkflow({
        app_id: appId,
        name: workflow.name,
        description: workflow.description,
      });

      // Store에 추가
      const newWorkflow: Workflow = {
        id: created.id,
        name: created.marked_name || workflow.name,
        description: created.marked_comment || '',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      set((state) => ({
        workflows: [...state.workflows, newWorkflow],
      }));

      return created.id;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      throw error;
    }
  },

  loadWorkflowsByApp: async (appId: string) => {
    try {
      const workflows = await workflowApi.listWorkflowsByApp(appId);

      // Convert backend workflows to frontend format
      const formattedWorkflows: Workflow[] = workflows.map((w) => ({
        id: w.id,
        name: w.marked_name || 'Untitled Workflow',
        description: w.marked_comment || '',
        icon: '🔄',
        nodes: [],
        edges: [],
      }));

      set({ workflows: formattedWorkflows });
    } catch (error) {
      console.error('Failed to load workflows:', error);
      throw error;
    }
  },

  setActiveWorkflow: (id) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (workflow) {
      set({
        activeWorkflowId: id,
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
    }
  },

  deleteWorkflow: (id) => {
    const { workflows, activeWorkflowId } = get();
    const filteredWorkflows = workflows.filter((w) => w.id !== id);

    if (id === activeWorkflowId && filteredWorkflows.length > 0) {
      const newActive = filteredWorkflows[0];
      set({
        workflows: filteredWorkflows,
        activeWorkflowId: newActive.id,
        nodes: newActive.nodes,
        edges: newActive.edges,
      });
    } else {
      set({ workflows: filteredWorkflows });
    }
  },

  updateWorkflowViewport: (id, viewport) => {
    const { workflows } = get();
    const updatedWorkflows = workflows.map((w) =>
      w.id === id ? { ...w, viewport } : w,
    );
    set({ workflows: updatedWorkflows });
  },

  // === API Sync Actions ===
  setFeatures: (features) => set({ features }),
  setEnvironmentVariables: (environmentVariables) =>
    set({ environmentVariables }),
  setConversationVariables: (conversationVariables) =>
    set({ conversationVariables }),

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      }),
    });
  },

  setWorkflowData: (data) => {
    set({
      nodes: data.nodes,
      edges: data.edges,
      features: data.features || {},
      environmentVariables: data.environmentVariables || [],
      conversationVariables: data.conversationVariables || [],
    });
    // Viewport는 ReactFlow 인스턴스에서 처리해야 하므로 여기서는 무시하거나 별도 처리
    // 하지만 초기 로딩 시 Store에 저장해두면 나중에 사용할 수 있음
  },
}));
