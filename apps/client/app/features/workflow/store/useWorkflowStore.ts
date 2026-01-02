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
  appId: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

type WorkflowState = {
  // === Editor UI 상태 (editorStore에서 유래) ===
  workflows: Workflow[];
  activeWorkflowId: string;
  sidebarCollapsed: SidebarState; // 사이드바 각 섹션의 접힘 상태
  activeConfigTab: 'logs' | 'monitoring';
  projectName: string;
  projectIcon: AppIcon;
  interactiveMode: 'mouse' | 'touchpad'; // 입력 모드 (마우스/터치패드)
  isFullscreen: boolean;

  // === 그래프 데이터 (ReactFlow) ===
  nodes: Node[];
  edges: Edge[];

  // === 추가 필드 (API 동기화용) ===
  features: Features; // 워크플로우 기능 설정
  envVariables: EnvVariable[]; // 환경 변수
  runtimeVariables: RuntimeVariable[]; // 런타임 변수

  // === ReactFlow 액션 ===
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // === Editor UI 액션 ===
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
  setActiveWorkflowIdSafe: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  updateWorkflowViewport: (
    id: string,
    viewport: { x: number; y: number; zoom: number },
  ) => void;

  // === API 동기화 액션 ===
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
    appId: '',
    nodes: initialNodes,
    edges: initialEdges,
    viewport: { x: 0, y: 0, zoom: 1 },
  },
];

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // === Editor UI 상태 ===
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

  // === 그래프 데이터 ===
  nodes: initialNodes,
  edges: initialEdges,
  features: {},
  envVariables: [],
  runtimeVariables: [],

  // === ReactFlow 액션 ===
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

  // === Editor UI 액션 ===
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
        appId: created.app_id,
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

      // Backend 워크플로우를 프론트엔드 포맷으로 변환
      const formattedWorkflows: Workflow[] = workflows.map((w) => ({
        id: w.id,
        appId: w.app_id,
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

  // **안전한 활성 워크플로우 ID 설정**
  // 기존 setActiveWorkflow와 달리, 노드나 엣지 데이터를 덮어쓰지 않고 ID만 변경합니다.
  // 새로고침 시 데이터가 로드되기 전에 빈 상태로 초기화되는 것을 방지하기 위해 사용합니다.
  setActiveWorkflowIdSafe: (id: string) => {
    set({ activeWorkflowId: id });
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

  // === API 동기화 액션 ===
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
