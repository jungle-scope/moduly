import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const workflowApi = {
  syncDraftWorkflow: async (workflowId: string, data: WorkflowDraftRequest) => {
    // data.nodes[0].variables에 시작노드의 input이 들어있음
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/draft`,
      data,
    );
    return response.data;
  },

  getDraftWorkflow: async (workflowId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/workflows/${workflowId}/draft`,
    );
    return response.data;
  },

  runWorkflow: async (workflowId: string) => {
    // 저장된 드래프트로 워크플로우 실행
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/execute`,
    );
    return response.data;
  },

  // 실행 생성
  publishWorkflow: async (workflowId: string, description?: string) => {
    // POST /api/v1/workflows/{id}/publish
    // description은 선택 사항 (버전 설명 등)
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/publish`,
      { description },
    );
    return response.data;
  },
};
