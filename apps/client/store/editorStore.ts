import { create } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow';

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

interface EditorState {
  workflows: Workflow[];
  activeWorkflowId: string;
  nodes: Node[];
  edges: Edge[];
  sidebarCollapsed: SidebarState;
  activeConfigTab: 'logs' | 'monitoring';
  projectName: string;
  projectIcon: string;
  interactiveMode: 'mouse' | 'touchpad';
  isFullscreen: boolean;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  toggleSidebarSection: (section: keyof SidebarState) => void;
  setActiveConfigTab: (tab: 'logs' | 'monitoring') => void;
  setProjectInfo: (name: string, icon: string) => void;
  setInteractiveMode: (mode: 'mouse' | 'touchpad') => void;
  toggleFullscreen: () => void;
  addWorkflow: (workflow: Omit<Workflow, 'id'>) => void;
  setActiveWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  updateWorkflowViewport: (
    id: string,
    viewport: { x: number; y: number; zoom: number },
  ) => void;
}

// Initial nodes matching the reference image
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 100, y: 200 },
  },
  {
    id: 'test-node',
    type: 'custom',
    data: {
      label: 'test',
      config: {},
      input: 'input',
      output: 'output',
    },
    position: { x: 350, y: 200 },
  },
  {
    id: 'end',
    type: 'output',
    data: { label: 'End' },
    position: { x: 600, y: 200 },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e-start-test',
    source: 'start',
    target: 'test-node',
    animated: true,
  },
  {
    id: 'e-test-end',
    source: 'test-node',
    target: 'end',
    animated: true,
  },
];

const initialWorkflows: Workflow[] = [
  {
    id: 'test',
    name: 'test',
    description: 'Test workflow',
    icon: '🔥',
    nodes: initialNodes,
    edges: initialEdges,
    viewport: { x: 0, y: 0, zoom: 1 },
  },
];

export const useEditorStore = create<EditorState>((set, get) => ({
  workflows: initialWorkflows,
  activeWorkflowId: 'test',
  nodes: initialNodes,
  edges: initialEdges,
  sidebarCollapsed: {
    workflow: false,
    plugin: true,
    data: true,
    configuration: false,
  },
  activeConfigTab: 'logs',
  projectName: 'test',
  projectIcon: '🔥',
  interactiveMode: 'mouse',
  isFullscreen: false,

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

  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    get().setNodes(newNodes);
  },

  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    get().setEdges(newEdges);
  },

  onConnect: (connection) => {
    const newEdges = addEdge(connection, get().edges);
    get().setEdges(newEdges);
  },

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

  addWorkflow: (workflow) => {
    const id = `workflow-${Date.now()}`;
    const newWorkflow: Workflow = {
      ...workflow,
      id,
      viewport: workflow.viewport || { x: 0, y: 0, zoom: 1 },
    };
    set((state) => ({
      workflows: [...state.workflows, newWorkflow],
    }));
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

    // If deleting the active workflow, switch to the first remaining one
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
}));
