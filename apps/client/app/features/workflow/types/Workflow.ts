export * from './Nodes';
import { Node } from './Nodes';

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  [key: string]: unknown;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'secret';
}

export interface RuntimeVariable {
  id: string;
  key: string;
  name: string;
}

export type Features = Record<string, any>;

export interface WorkflowDraftRequest {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  features?: Features;
  envVariables?: EnvVariable[];
  runtimeVariables?: RuntimeVariable[];
}
