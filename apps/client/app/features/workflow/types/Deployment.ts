export type DeploymentType = 'api' | 'widget' | 'mcp' | 'webapp';

export interface DeploymentBase {
  type: DeploymentType;
  url_slug?: string;
  description?: string;
  config?: Record<string, any>;
  is_active: boolean;
}

export interface DeploymentCreate extends DeploymentBase {
  workflow_id: string;
  graph_snapshot?: Record<string, any>;
  auth_secret?: string;
}

export interface DeploymentResponse extends DeploymentBase {
  id: string;
  workflow_id: string;
  version: number;
  auth_secret?: string;
  created_by: string;
  created_at: string;
  graph_snapshot: Record<string, any>;
}
