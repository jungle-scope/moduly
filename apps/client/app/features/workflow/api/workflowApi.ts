import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';
import { DeploymentCreate, DeploymentResponse } from '../types/Deployment';
import { WorkflowCreateRequest, WorkflowResponse } from '../types/Api';

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`;

// Axios 인스턴스 생성 (withCredentials 설정)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ 쿠키 자동 전송
});

// 401 에러 인터셉터 (인증 만료 시 로그인 페이지로)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 만료 → 로그인 페이지로 리다이렉트
      console.warn('Authentication expired, redirecting to login...');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

export const workflowApi = {
  // 1. 드래프트 워크플로우 동기화 (저장)
  syncDraftWorkflow: async (workflowId: string, data: WorkflowDraftRequest) => {
    const response = await api.post(`/workflows/${workflowId}/draft`, data);
    return response.data;
  },

  // 2. 드래프트 워크플로우 가져오기
  getDraftWorkflow: async (workflowId: string) => {
    const response = await api.get(`/workflows/${workflowId}/draft`);
    return response.data;
  },

  // 3. 워크플로우 실행
  executeWorkflow: async (
    workflowId: string,
    userInput?: Record<string, unknown>,
  ) => {
    const response = await api.post(
      `/workflows/${workflowId}/execute`,
      userInput || {},
    );
    return response.data;
  },

  // 3-1. 워크플로우 스트리밍 실행 (SSE)
  executeWorkflowStream: async (
    workflowId: string,
    userInput: Record<string, unknown> | FormData,
    onEvent?: (event: any) => void | Promise<void>,
  ) => {
    const isFormData = userInput instanceof FormData;

    console.log(
      '[사용자 입력]: ',
      isFormData ? 'FormData (파일 포함)' : JSON.stringify(userInput || {}),
    );

    const response = await fetch(
      `${API_BASE_URL}/workflows/${workflowId}/stream`,
      {
        method: 'POST',
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 인증 포함
        body: isFormData ? userInput : JSON.stringify(userInput || {}),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Workflow execution failed');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 유지

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const event = JSON.parse(jsonStr);
            if (onEvent) await onEvent(event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }

    // 남은 버퍼 처리
    if (buffer.startsWith('data: ')) {
      try {
        const jsonStr = buffer.slice(6);
        const event = JSON.parse(jsonStr);
        if (onEvent) await onEvent(event);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    }
  },

  // 4. 단일 워크플로우 상세 조회
  getWorkflow: async (workflowId: string): Promise<WorkflowResponse> => {
    const response = await api.get(`/workflows/${workflowId}`);
    return response.data;
  },

  // 5. 새 워크플로우 생성
  createWorkflow: async (
    data: WorkflowCreateRequest,
  ): Promise<WorkflowResponse> => {
    const response = await api.post('/workflows', data);
    return response.data;
  },

  // 6. 특정 App의 워크플로우 목록 조회
  listWorkflowsByApp: async (appId: string): Promise<WorkflowResponse[]> => {
    const response = await api.get(`/workflows/app/${appId}`);
    return response.data;
  },

  createDeployment: async (data: DeploymentCreate) => {
    const response = await api.post('/deployments', data);
    return response.data as DeploymentResponse;
  },

  getDeployments: async (workflowId: string) => {
    const response = await api.get('/deployments', {
      params: { workflow_id: workflowId },
    });
    return response.data as DeploymentResponse[];
  },

  // [NEW] 워크플로우 실행 이력 조회
  getWorkflowRuns: async (workflowId: string, page = 1, limit = 20) => {
    const response = await api.get(`/workflows/${workflowId}/runs`, {
      params: { page, limit },
    });
    return response.data as WorkflowRunListResponse;
  },

  // [NEW] 단일 워크플로우 실행 이력 상세 조회
  getWorkflowRun: async (workflowId: string, runId: string) => {
    const response = await api.get(`/workflows/${workflowId}/runs/${runId}`);
    return response.data as import('../types/Api').WorkflowRun;
  },

  // [NEW] 대시보드 통계 조회
  getDashboardStats: async (workflowId: string) => {
    const response = await api.get(`/workflows/${workflowId}/stats`);
    return response.data as import('../types/Api').DashboardStatsResponse;
  },

  // [NEW] Top 3 Models
  getTopExpensiveModels: async () => {
    const response = await api.get('/llm/stats/top-models'); // Note: baseURL is /api/v1
    return response.data as import('../types/Api').TopExpensiveModel[];
  },

  getDeployment: async (deploymentId: string) => {
    const response = await api.get(`/deployments/${deploymentId}`);
    return response.data as DeploymentResponse;
  },

  listWorkflowNodes: async () => {
    const response = await api.get('/deployments/nodes');
    return response.data as {
      deployment_id: string;
      app_id: string;
      name: string;
      description: string;
      version: number;
      input_schema: any;
      output_schema: any;
    }[];
  },
};
