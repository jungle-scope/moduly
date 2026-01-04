import axios from 'axios';
import {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
} from '../types/auth';

const API_BASE_URL = '/api/v1';

export const authApi = {
  // 회원가입
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const response = await axios.post(
      `${API_BASE_URL}/auth/signup`,
      data,
      { withCredentials: true }, // 쿠키 자동 전송
    );
    return response.data;
  },

  // 로그인
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      data,
      { withCredentials: true }, // 쿠키 자동 전송
    );
    return response.data;
  },

  // 로그아웃
  logout: async (): Promise<void> => {
    await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {},
      { withCredentials: true },
    );
  },

  // 현재 사용자 정보 조회
  me: async (): Promise<LoginResponse> => {
    const response = await axios.get(
      `${API_BASE_URL}/auth/me`,
      { withCredentials: true }, // 쿠키 자동 전송
    );
    return response.data;
  },

  // 구글 OAuth 로그인
  googleLogin: () => {
    // FastAPI 백엔드의 구글 로그인 엔드포인트로 리다이렉트
    window.location.href = `${API_BASE_URL}/auth/google/login`;
  },
};
