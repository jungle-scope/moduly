import axios from 'axios';
import { DBConfig } from '../types/db';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

//TODO: 이 파일 저 파일에 겹쳐있는 부분인데 리팩토링 필요
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 401 에러 인터셉터 (인증 만료 시 로그인 페이지로 리다이렉트)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

export const connectorApi = {
  /**
   * DB 연결 정보 저장 및 Connector 생성 요청
   *
   * @param config - 사용자가 입력한 DB 연결 정보
   * @returns 생성된 커넥터 정보
   */
  createConnector: async (
    config: DBConfig,
  ): Promise<{ id: string; success: boolean; message: string }> => {
    const payload = {
      connection_name: config.connectionName,
      type: config.type,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssh: config.ssh?.enabled
        ? {
            enabled: true,
            host: config.ssh.host,
            port: config.ssh.port,
            username: config.ssh.username,
            auth_type: config.ssh.authType === 'key' ? 'key' : 'password',
            password: config.ssh.password,
            private_key: config.ssh.privateKey,
          }
        : null,
    };

    const response = await api.post('/connectors', payload);
    return response.data;
  },

  getSchema: async (connectionId: string): Promise<any> => {
    const response = await api.get(`/connectors/${connectionId}/schema`);
    return response.data;
  },

  /**
   * DB 연결 상세 정보 조회 (비밀번호 제외)
   *
   * @param connectedId - 연결 ID
   * @returns 저장된 DB연결 정보
   */
  getConnectionDetails: async (connectionId: string): Promise<any> => {
    const response = await api.get(`/connectors/${connectionId}`);
    return response.data;
  },
};
