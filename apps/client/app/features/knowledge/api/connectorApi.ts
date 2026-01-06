import { apiClient } from '@/lib/apiClient';
import { DBConfig } from '../types/DB';

const api = apiClient;

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

  /**
   * DB 연결 테스트
   * @param config - DB 연결 정보
   * @returns 성공 여부 및 메시지
   */
  testConnection: async (
    config: DBConfig,
  ): Promise<{ success: boolean; message: string }> => {
    try {
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

      const response = await api.post('/connectors/test', payload);
      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error: any) {
      console.error('DB Connection Test Error', error);
      return {
        success: false,
        message:
          error.response?.data?.message || error.message || 'Unknown Error',
      };
    }
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
