import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';

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
    // develop 브랜치의 주석 반영: data.nodes[0].variables에 시작노드의 input이 들어있음
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
    // develop 브랜치의 최신 인자(workflowId, userInput)와 엔드포인트를 따르되,
    // 인증 처리를 위해 axios 대신 api 인스턴스를 사용합니다.
    const response = await api.post(
      `/workflows/${workflowId}/execute`,
      userInput || {},
    );
    return response.data;
  },

  // 4. 새 워크플로우 생성
  createWorkflow: async (
    data: WorkflowCreateRequest,
  ): Promise<WorkflowResponse> => {
    const response = await api.post('/workflows', data);
    return response.data;
  },

  // 5. 특정 App의 워크플로우 목록 조회
  listWorkflowsByApp: async (appId: string): Promise<WorkflowResponse[]> => {
    const response = await api.get(`/workflows/app/${appId}`);
    return response.data;
  },
};
