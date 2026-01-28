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

// 로그 관련 타입 (Backend Schemas와 일치)
export interface WorkflowNodeRun {
  id: string;
  node_id: string;
  node_type: string;
  status: string;
  inputs?: Record<string, any>;
  process_data?: Record<string, any>; // 노드 옵션 스냅샷 (실행 시점 설정)
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
  trigger_mode: 'manual' | 'scheduler' | 'api' | 'app' | 'webhook';
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error_message?: string;
  started_at: string;
  finished_at?: string;
  duration?: number;
  workflow_version?: number;
  total_tokens?: number;
  total_cost?: number;
  node_runs?: WorkflowNodeRun[];
}

// Dashboard Stats Types
export interface StatsSummary {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
  avgTokenPerRun: number;
  avgCostPerRun: number;
}

export interface DailyRunStat {
  date: string;
  count: number;
  total_cost: number;
  total_tokens: number;
}

export interface RunCostStat {
  run_id: string;
  started_at: string;
  total_tokens: number;
  total_cost: number;
}

export interface FailureStat {
  node_id: string;
  node_name: string;
  count: number;
  reason: string;
  rate: string;
}

export interface RecentFailure {
  run_id: string;
  failed_at: string; // ISO date
  node_id: string;
  error_message: string;
}

export interface DashboardStatsResponse {
  summary: StatsSummary;
  runsOverTime: DailyRunStat[];
  minCostRuns: RunCostStat[];
  maxCostRuns: RunCostStat[];
  failureAnalysis: FailureStat[];
  recentFailures: RecentFailure[];
}

export interface WorkflowRunListResponse {
  total: number;
  items: WorkflowRun[];
}

export interface TopExpensiveModel {
  model_name: string;
  provider_name: string;
  total_cost: number;
  total_tokens: number;
}
