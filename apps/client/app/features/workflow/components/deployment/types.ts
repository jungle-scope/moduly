import { InputSchema, OutputSchema } from '../../types/Deployment';

export type DeploymentStep = 'input' | 'success' | 'error';
export type DeploymentType =
  | 'api'
  | 'webapp'
  | 'widget'
  | 'workflow_node'
  | 'schedule';

export interface DeploymentResult {
  success: boolean;
  url_slug?: string | null;
  auth_secret?: string | null;
  version?: number;
  webAppUrl?: string;
  embedUrl?: string;
  isWorkflowNode?: boolean;
  input_schema?: InputSchema | null;
  output_schema?: OutputSchema | null;
  message?: string; // Error message
  cronExpression?: string; // Schedule trigger용
  timezone?: string; // Schedule trigger용
}
