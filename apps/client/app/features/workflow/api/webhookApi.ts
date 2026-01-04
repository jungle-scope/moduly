import axios from 'axios';

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`;

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 401 에러 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Authentication expired, redirecting to login...');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

export interface CaptureStatusResponse {
  status: 'waiting' | 'captured';
  payload?: Record<string, unknown>;
}

export const webhookApi = {
  /**
   * 캡처 세션 시작
   */
  startCapture: async (urlSlug: string): Promise<{ status: string }> => {
    const response = await api.get(`/hooks/${urlSlug}/capture/start`);
    return response.data;
  },

  /**
   * 캡처 상태 조회
   */
  getCaptureStatus: async (urlSlug: string): Promise<CaptureStatusResponse> => {
    const response = await api.get(`/hooks/${urlSlug}/capture/status`);
    return response.data;
  },
};
