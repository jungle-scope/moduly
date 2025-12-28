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

  runWorkflow: async (workflowId: string, userInput?: any) => {
    // 저장된 드래프트로 워크플로우 실행
    // userInput이 있으면 같이 보냄 (Develop support)
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/execute`,
      userInput || {}, // Ensure body is sent if needed, or modify backend to accept empty
    );
    return response.data;
  },
};
