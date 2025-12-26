import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
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
} from '../types/Workflow';

type WorkflowState = {
  // === Graph Data ===
  nodes: Node[];
  edges: Edge[];

  // === Extra Fields ===
  features: Features;
  environmentVariables: EnvironmentVariable[];
  conversationVariables: ConversationVariable[];

  // === Actions ===
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // === New Actions for Granular Updates ===
  setFeatures: (features: Features) => void;
  setEnvironmentVariables: (vars: EnvironmentVariable[]) => void;
  setConversationVariables: (vars: ConversationVariable[]) => void;

  // 특정 노드의 data 필드만 업데이트하는 함수
  updateNodeData: (nodeId: string, newData: Record<string, unknown>) => void;
};


export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  features: {},
  environmentVariables: [],
  conversationVariables: [],

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),

  setFeatures: (features) => set({ features }),
  setEnvironmentVariables: (environmentVariables) =>
    set({ environmentVariables }),
  setConversationVariables: (conversationVariables) =>
    set({ conversationVariables }),

  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          // 기존 데이터와 병합 (Shallow Merge)
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      }),
    });
  },
}));
