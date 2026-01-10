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
      if (typeof window !== 'undefined') {
        const isLoginPage = window.location.pathname.startsWith('/auth/login');
        if (!isLoginPage) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
