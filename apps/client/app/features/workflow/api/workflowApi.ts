import axios from 'axios';
import { WorkflowDraftRequest } from '../types/Workflow';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const workflowApi = {
  syncDraftWorkflow: async (workflowId: string, data: WorkflowDraftRequest) => {
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
};
