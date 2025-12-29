import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';
import { DeploymentCreate, DeploymentResponse } from '../types/Deployment';

const API_BASE_URL = 'http://localhost:8000/api/v1';

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

export interface WorkflowCreateRequest {
  app_id: string;
  name: string;
  description?: string;
}

export interface WorkflowResponse {
  id: string;
  app_id: string;
  marked_name: string | null;
  marked_comment: string | null;
  created_at: string;
  updated_at: string;
}

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
    const response = await api.post('/deployments/', data);
    return response.data as DeploymentResponse;
  },

  getDeployments: async (workflowId: string) => {
    const response = await api.get('/deployments/', {
      params: { workflow_id: workflowId },
    });
    return response.data as DeploymentResponse[];
  },
};
