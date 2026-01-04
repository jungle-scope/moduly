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
import { DeploymentResponse } from '../types/Deployment';

import { create } from 'zustand';
import { DEFAULT_NODES } from '../constants';
import { workflowApi } from '../api/workflowApi';

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

  projectName: string;
  projectIcon: AppIcon;
  interactiveMode: 'mouse' | 'touchpad'; // 입력 모드 (마우스/터치패드)
  isFullscreen: boolean;

  // === 버전 기록 상태 ===
  isVersionHistoryOpen: boolean;
  previewingVersion: DeploymentResponse | null;
  lastDeployedAt: Date | null; // 배포 완료 시점 (리스트 갱신 트리거)

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
  toggleVersionHistory: () => void;
  previewVersion: (version: DeploymentResponse) => void;
  exitPreview: () => void;
  restoreVersion: (version: DeploymentResponse) => Promise<void>;
  notifyDeploymentComplete: () => void; // 배포 완료 알림

  // === Editor UI 액션 ===

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
  setWorkflowData: (
    data: {
      nodes: Node[];
      edges: Edge[];
      viewport: { x: number; y: number; zoom: number };
      features?: Features;
      envVariables?: EnvVariable[];
      runtimeVariables?: RuntimeVariable[];
    },
    workflowId?: string,
  ) => void;
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

  projectName: 'My Project',
  projectIcon: { type: 'emoji', content: '🔥', background_color: '#FFE5D4' },
  interactiveMode: 'mouse',
  isFullscreen: false,

  // === 버전 기록 상태 ===
  isVersionHistoryOpen: false,
  previewingVersion: null,
  lastDeployedAt: null,

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
    // DB에 deletable:false로 저장된 노드도 삭제 가능하도록 속성 제거
    // TODO: 데이터 마이그레이션 후 제거 필요
    const deletableNodes = currentNodes.map((node) => {
      const { deletable, ...rest } = node as any;
      return rest;
    });
    const newNodes = applyNodeChanges(changes, deletableNodes);
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

  setProjectInfo: (name, icon) => set({ projectName: name, projectIcon: icon }),

  setInteractiveMode: (mode) => set({ interactiveMode: mode }),

  toggleFullscreen: () =>
    set((state) => ({ isFullscreen: !state.isFullscreen })),

  // === 버전 기록 액션 ===
  toggleVersionHistory: () =>
    set((state) => ({ isVersionHistoryOpen: !state.isVersionHistoryOpen })),

  previewVersion: (version) => {
    // 현재 스냅샷을 노드/엣지에 적용 (미리보기)
    const snapshot = version.graph_snapshot;
    set({
      previewingVersion: version,
      nodes: snapshot.nodes || [],
      edges: snapshot.edges || [],
    });
  },

  exitPreview: () => {
    // 미리보기 종료 시 현재 드래프트 상태로 복구
    // activeWorkflowId에 해당하는 데이터를 다시 로드
    const { workflows, activeWorkflowId } = get();
    const currentWorkflow = workflows.find((w) => w.id === activeWorkflowId);

    if (currentWorkflow) {
      set({
        previewingVersion: null,
        nodes: currentWorkflow.nodes,
        edges: currentWorkflow.edges,
      });
    } else {
      set({ previewingVersion: null });
    }
  },

  notifyDeploymentComplete: () => set({ lastDeployedAt: new Date() }),

  restoreVersion: async (version) => {
    const state = get();
    const { activeWorkflowId } = state;

    try {
      // 1. 스냅샷 데이터로 현재 드래프트 업데이트 API 호출
      const snapshot = version.graph_snapshot;
      await workflowApi.syncDraftWorkflow(activeWorkflowId, {
        nodes: snapshot.nodes || [],
        edges: snapshot.edges || [],
        viewport: { x: 0, y: 0, zoom: 1 }, // 뷰포트는 초기화하거나 스냅샷에서 가져옴
      });

      // 2. Store, local state 업데이트
      const { workflows } = get();
      const updatedWorkflows = workflows.map((w) =>
        w.id === activeWorkflowId
          ? { ...w, nodes: snapshot.nodes || [], edges: snapshot.edges || [] }
          : w,
      );

      set({
        workflows: updatedWorkflows,
        nodes: snapshot.nodes || [],
        edges: snapshot.edges || [],
        previewingVersion: null, // 미리보기 종료
      });
    } catch (error) {
      console.error('Failed to restore version:', error);
      throw error;
    }
  },

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
      const currentWorkflows = get().workflows;

      // Backend 워크플로우를 프론트엔드 포맷으로 변환
      const formattedWorkflows: Workflow[] = workflows.map((w) => {
        const existing = currentWorkflows.find((cw) => cw.id === w.id);
        return {
          id: w.id,
          appId: w.app_id,
          nodes: existing?.nodes?.length ? existing.nodes : [],
          edges: existing?.edges?.length ? existing.edges : [],
          viewport: existing?.viewport || { x: 0, y: 0, zoom: 1 },
        };
      });

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

  setWorkflowData: (data: any, workflowId?: string) => {
    set({
      nodes: data.nodes || [],
      edges: data.edges || [],
      features: data.features || {},
      envVariables: data.envVariables || [],
      runtimeVariables: data.runtimeVariables || [],
    });

    const { activeWorkflowId, workflows } = get();
    const targetId = workflowId || activeWorkflowId;

    if (targetId) {
      const exists = workflows.some((w) => w.id === targetId);
      let updatedWorkflows;

      if (exists) {
        updatedWorkflows = workflows.map((w) =>
          w.id === targetId
            ? {
                ...w,
                nodes: data.nodes || [],
                edges: data.edges || [],
                ...(data.viewport ? { viewport: data.viewport } : {}),
              }
            : w,
        );
      } else {
        updatedWorkflows = [
          ...workflows,
          {
            id: targetId,
            appId: '',
            nodes: data.nodes || [],
            edges: data.edges || [],
            viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
          },
        ];
      }
      set({ workflows: updatedWorkflows });
    }
  },
}));
