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

export const workflowApi = {
  syncDraftWorkflow: async (workflowId: string, data: WorkflowDraftRequest) => {
    const response = await api.post(`/workflows/${workflowId}/draft`, data);
    return response.data;
  },

  getDraftWorkflow: async (workflowId: string) => {
    const response = await api.get(`/workflows/${workflowId}/draft`);
    return response.data;
  },

  executeWorkflow: async (appId: string, data: WorkflowDraftRequest) => {
    // 실제로 워크플로우를 실행하는 함수
    // 일단은 엔드포인트를 http://localhost:8000/api/v1/workflow/execute로 가정

    const response = await api.post(`/workflow/execute`, data);
    return response.data;
  },
};
