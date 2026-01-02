// API 요청 & 응답과 관련된 타입들을 정의합니다.

export interface WorkflowCreateRequest {
  app_id: string;
}

export interface WorkflowResponse {
  id: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}

// [NEW] 로그 관련 타입 (Backend Schemas와 일치)
export interface WorkflowNodeRun {
  id: string;
  node_id: string;
  node_type: string;
  status: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  user_id: string;
  status: string;
  trigger_mode: 'manual' | 'scheduler' | 'api' | 'deployed' | 'app';
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
  duration?: number;
  workflow_version?: number; // [NEW]
  total_tokens?: number;     // [NEW]
  total_cost?: number;       // [NEW]
  node_runs?: WorkflowNodeRun[];
}

// [NEW] 대시보드 통계 타입
export interface DashboardStats {
  summary: {
    totalRuns: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
  };
  runsOverTime: {
    name: string;
    runs: number;
  }[];
  costAnalysis: {
    name: string;
    tokens: number;
    cost: number;
  }[];
  failureAnalysis: {
    node: string;
    count: number;
    reason: string;
    rate: string;
  }[];
}

export interface WorkflowRunListResponse {
  total: number;
  items: WorkflowRun[];
}
