import { AppIcon } from '../../app/api/appApi';
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
  EnvVariable,
  RuntimeVariable,
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
  projectIcon: AppIcon;
  interactiveMode: 'mouse' | 'touchpad';
  isFullscreen: boolean;

  // === Graph Data ===
  nodes: Node[];
  edges: Edge[];

  // === Extra Fields (for API sync) ===
  features: Features;
  envVariables: EnvVariable[];
  runtimeVariables: RuntimeVariable[];

  // === ReactFlow Actions ===
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // === Editor UI Actions ===
  toggleSidebarSection: (section: keyof SidebarState) => void;
  setActiveConfigTab: (tab: 'logs' | 'monitoring') => void;
  setProjectInfo: (name: string, icon: AppIcon) => void;
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
  setEnvVariables: (vars: EnvVariable[]) => void;
  setRuntimeVariables: (vars: RuntimeVariable[]) => void;
  updateNodeData: (nodeId: string, newData: Record<string, unknown>) => void;
  setWorkflowData: (data: {
    nodes: Node[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
    features?: Features;
    envVariables?: EnvVariable[];
    runtimeVariables?: RuntimeVariable[];
  }) => void;
};

// Initial data
const initialNodes: Node[] = DEFAULT_NODES;
const initialEdges: Edge[] = [];

const initialWorkflows: Workflow[] = [
  {
    id: 'default',
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
  projectIcon: { type: 'emoji', content: '🔥', background_color: '#FFE5D4' },
  interactiveMode: 'mouse',
  isFullscreen: false,

  // === Graph Data ===
  nodes: initialNodes,
  edges: initialEdges,
  features: {},
  envVariables: [],
  runtimeVariables: [],

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
    const currentNodes = get().nodes || [];
    const newNodes = applyNodeChanges(changes, currentNodes);
    get().setNodes(newNodes as Node[]);
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    const currentEdges = get().edges || [];
    const newEdges = applyEdgeChanges(changes, currentEdges);
    get().setEdges(newEdges);
  },

  onConnect: (connection: Connection) => {
    const currentEdges = get().edges || [];
    const newEdges = addEdge(connection, currentEdges);
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
      });

      // Store에 추가
      const newWorkflow: Workflow = {
        id: created.id,
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
  setEnvVariables: (envVariables) => set({ envVariables }),
  setRuntimeVariables: (runtimeVariables) => set({ runtimeVariables }),

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          } as Node;
        }
        return node;
      }),
    });
  },

  setWorkflowData: (data) => {
    set({
      nodes: data.nodes || [],
      edges: data.edges || [],
      features: data.features || {},
      envVariables: data.envVariables || [],
      runtimeVariables: data.runtimeVariables || [],
    });
    // Viewport는 ReactFlow 인스턴스에서 처리해야 하므로 여기서는 무시하거나 별도 처리
    // 하지만 초기 로딩 시 Store에 저장해두면 나중에 사용할 수 있음
  },
}));
