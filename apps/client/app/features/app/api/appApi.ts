import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 401 에러 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

export interface App {
  id: string;
  name: string;
  description?: string;
  icon: string;
  icon_background: string;
  workflow_id?: string;
  created_at: string;
  updated_at: string;
}

export const appApi = {
  // 앱 목록 조회
  listApps: async (): Promise<App[]> => {
    const response = await api.get('/apps');
    return response.data;
  },

  // 앱 생성
  createApp: async (data: {
    name: string;
    description?: string;
    icon: string;
    icon_background: string;
  }): Promise<App> => {
    const response = await api.post('/apps', data);
    return response.data;
  },

  // 앱 상세 조회
  getApp: async (appId: string): Promise<App> => {
    const response = await api.get(`/apps/${appId}`);
    return response.data;
  },
};
