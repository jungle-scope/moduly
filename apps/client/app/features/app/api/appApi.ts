import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface CreateAppRequest {
  name: string;
  description: string;
  icon: string;
  icon_background: string;
}

export interface AppResponse {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_background: string;
  created_at: string;
  updated_at: string;
}

export const appApi = {
  /**
   * 새로운 앱을 생성합니다.
   */
  createApp: async (data: CreateAppRequest): Promise<AppResponse> => {
    const response = await axios.post(`${API_BASE_URL}/apps`, data);
    return response.data;
  },

  /**
   * 앱을 ID로 조회합니다.
   */
  getApp: async (appId: string): Promise<AppResponse> => {
    const response = await axios.get(`${API_BASE_URL}/apps/${appId}`);
    return response.data;
  },
};
