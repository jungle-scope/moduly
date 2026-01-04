import { useState } from 'react';
import {
  Server,
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  SUPPORTED_DB_TYPES,
  SupportedDbType,
  DBConfig,
} from '@/app/features/knowledge/types/DB';

// 타입 정의

interface Props {
  onChange: (config: DBConfig) => void;
  onTestConnection: (config: DBConfig) => Promise<boolean>; // 부모 컴포넌트에서 테스트 로직 주입
  initialConfig?: Partial<DBConfig>; // DB 연결 수정 원래 값 보여주기 용도
}

export default function DBConnectionForm({
  onChange,
  onTestConnection,
  initialConfig,
}: Props) {
  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );
  const [config, setConfig] = useState<DBConfig>({
    connectionName: initialConfig?.connectionName || '',
    type: initialConfig?.type || SUPPORTED_DB_TYPES[0].value,
    host: initialConfig?.host || '',
    port: initialConfig?.port || 5432,
    database: initialConfig?.database || '',
    username: initialConfig?.username || '',
    password: '', // 비밀번호는 항상 빈 값으로 시작
    ssh: {
      enabled: initialConfig?.ssh?.enabled || false,
      host: initialConfig?.ssh?.host || '',
      port: initialConfig?.ssh?.port || 22,
      username: initialConfig?.ssh?.username || '',
      authType: initialConfig?.ssh?.authType || 'password',
      password: '', // SSH 비밀번호도 항상 빈 값
      privateKey: '', // SSH 키도 항상 빈 값
    },
  });

  // 입력 핸들러 (중첩 객체 업데이트 유틸리티 필요)
  const handleChange = (field: string, value: any, isSsh = false) => {
    const newConfig = { ...config };

    if (isSsh) {
      newConfig.ssh = { ...config.ssh, [field]: value };
    } else {
      (newConfig as any)[field] = value;
    }

    setConfig(newConfig); // 로컬 상태 업데이트
    onChange(newConfig); // 부모 상태 업데이트
    setTestStatus('idle'); // 수정 시 테스트 상태 초기화
    return newConfig;
  };

  // 키 파일 읽기 핸들러
  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleChange('privateKey', event.target?.result as string, true);
      };
      reader.readAsText(file);
    }
  };

  // 연결 테스트 핸들러
  const handleTest = async () => {
    setLoading(true);
    setTestStatus('idle');
    try {
      const success = await onTestConnection(config);
      setTestStatus(success ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 기본 연결 정보 */}
      <div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              연결 이름 (Alias)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="예: 운영 DB"
              value={config.connectionName}
              onChange={(e) => handleChange('connectionName', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              데이터베이스 타입
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={config.type}
              onChange={(e) =>
                handleChange('type', e.target.value as SupportedDbType)
              }
            >
              {SUPPORTED_DB_TYPES.map((db) => (
                <option key={db.value} value={db.value} disabled={db.disabled}>
                  {db.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Host
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="127.0.0.1"
                value={config.host}
                onChange={(e) => handleChange('host', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Port
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={config.port}
                onChange={(e) => handleChange('port', Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Database Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="postgres"
              value={config.database}
              onChange={(e) => handleChange('database', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={config.username}
                onChange={(e) => handleChange('username', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={config.password}
                onChange={(e) => handleChange('password', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SSH 터널링 섹션 */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Shield className="w-4 h-4" /> SSH 사용
          </label>
          <input
            type="checkbox"
            className="toggle checkbox-primary"
            checked={config.ssh.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked, true)}
          />
        </div>

        {config.ssh.enabled && (
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-3 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  SSH Host
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="bastion.example.com"
                  value={config.ssh.host}
                  onChange={(e) => handleChange('host', e.target.value, true)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  SSH Port
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={config.ssh.port}
                  onChange={(e) =>
                    handleChange('port', Number(e.target.value), true)
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                SSH Username
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={config.ssh.username}
                onChange={(e) => handleChange('username', e.target.value, true)}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                인증 방식
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="authType"
                    checked={config.ssh.authType === 'password'}
                    onChange={() => handleChange('authType', 'password', true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    Password
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="authType"
                    checked={config.ssh.authType === 'key'}
                    onChange={() => handleChange('authType', 'key', true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    Private Key
                  </span>
                </label>
              </div>
            </div>

            {config.ssh.authType === 'password' ? (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  SSH Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={config.ssh.password || ''}
                  onChange={(e) =>
                    handleChange('password', e.target.value, true)
                  }
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Private Key File
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-700">
                      <Key className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {config.ssh.privateKey ? '키 파일 로드됨' : '파일 선택'}
                      </span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleKeyFileUpload}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 테스트 버튼 */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 min-h-[20px]">
          {testStatus === 'success' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> 연결 성공!
            </span>
          )}
          {testStatus === 'error' && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> 연결 실패
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border border-gray-200 dark:border-gray-600"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Server className="w-3 h-3" />
          )}
          연결
        </button>
      </div>
    </div>
  );
}
