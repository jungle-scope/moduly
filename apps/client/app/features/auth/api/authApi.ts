import { apiClient } from '@/lib/apiClient';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
} from '../types/auth';

export const authApi = {
  // 회원가입
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  // 로그인
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  // 로그아웃
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout', {});
  },

  // 현재 사용자 정보 조회
  me: async (): Promise<LoginResponse> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  // 구글 OAuth 로그인
  googleLogin: () => {
    // apiClient의 baseURL 사용
    const baseURL = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
      : '/api/v1';
    window.location.href = `${baseURL}/auth/google/login`;
  },
};
