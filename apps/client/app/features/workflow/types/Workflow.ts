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

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'secret';
}

export interface ConversationVariable {
  id: string;
  key: string;
  name: string;
}

// Features: e.g. { "file_upload": { "enabled": true }, ... }
export type Features = Record<string, Record<string, unknown>>;

export interface WorkflowDraftRequest {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  features?: Features;
  environmentVariables?: EnvironmentVariable[];
  conversationVariables?: ConversationVariable[];
}
