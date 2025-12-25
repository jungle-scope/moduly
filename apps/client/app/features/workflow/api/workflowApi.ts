import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';

const API_BASE_URL = 'http://localhost:8000/api/v1'; // 필요시 수정

export const workflowApi = {
  syncDraftWorkflow: async (appId: string, data: WorkflowDraftRequest) => {
    // URL에 appId가 필요하다고 가정 (계획의 'sync' 페이로드에는 명시되지 않았음)
    // 계획에 맞춰 엔드포인트 수정: POST /workflows/draft 또는 POST /apps/{appId}/workflows/draft

    // 현재는 전역 초안 또는 특정 앱 초안으로 가정.
    // Dify는 보통 /apps/{appId}/workflows/draft 형식을 사용함
    const response = await axios.post(`${API_BASE_URL}/workflows/draft`, data);
    return response.data;
  },
};
