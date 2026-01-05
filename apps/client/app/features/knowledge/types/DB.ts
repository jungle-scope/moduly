export const SUPPORTED_DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', disabled: false },
  { value: 'mysql', label: 'MySQL (Coming Soon)', disabled: true },
] as const;

export type SupportedDbType = (typeof SUPPORTED_DB_TYPES)[number]['value'];

export interface DBConfig {
  connectionName: string;
  type: SupportedDbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssh: {
    enabled: boolean;
    host?: string;
    port?: number;
    username?: string;
    authType?: 'password' | 'key';
    password?: string;
    privateKey?: string;
  };
}
