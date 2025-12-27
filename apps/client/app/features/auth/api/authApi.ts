import axios from 'axios';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
} from '../types/auth';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const authApi = {
  // 회원가입
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const response = await axios.post(`${API_BASE_URL}/auth/signup`, data);
    return response.data;
  },

  // 로그인
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, data);
    return response.data;
  },

  // 구글 OAuth 로그인
  googleLogin: () => {
    // FastAPI 백엔드의 구글 로그인 엔드포인트로 리다이렉트
    window.location.href = `${API_BASE_URL}/auth/google/login`;
  },
};
