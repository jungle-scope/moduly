import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
    : '/api/v1',
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 로그인/회원가입 페이지에서는 리다이렉트하지 않음 (에러 메시지를 보여주기 위해)
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/auth')
      ) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);
