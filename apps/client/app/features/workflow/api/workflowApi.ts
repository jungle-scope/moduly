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

  executeWorkflow: async (
    workflowId: string,
    userInput?: Record<string, unknown>, // 키는 문자열이고 값은 알 수 없는 객체 형태인 타입 사용
  ) => {
    // 저장된 드래프트로 워크플로우 실행
    // userInput이 있으면 같이 보냄 (Develop support)
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowId}/execute`,
      userInput || {},
    );
    return response.data;
  },
};
