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
    const response = await api.post(`/workflows/${workflowId}/execute`, userInput || {});
    return response.data;
  },

  createDeployment: async (data: DeploymentCreate) => {
    const response = await axios.post(`${API_BASE_URL}/deployments/`, data);
    return response.data as DeploymentResponse;
  },

  getDeployments: async (workflowId: string) => {
    const response = await axios.get(`${API_BASE_URL}/deployments/`, {
      params: { workflow_id: workflowId },
    });
    return response.data as DeploymentResponse[];
  },
};
