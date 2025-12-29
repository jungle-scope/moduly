'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

type ProviderResponse = {
  id: string;
  provider_name: string;
  provider_type: string;
  is_valid: boolean;
  credentials: {
    id: string;
    credential_name: string;
    encrypted_config: string;
  }[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

type ProviderType = 'openai';

// provider별 기본값(라벨/기본 URL/모델/키 힌트)을 한 곳에 모아둠
const PROVIDER_PRESETS: Record<
  ProviderType,
  { label: string; baseUrl: string; model: string; apiKeyHint: string }
> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyHint: 'sk-...',
  },
};

export default function SettingsProviderPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderResponse[]>([]);
  const [form, setForm] = useState({
    alias: '',
    apiKey: '',
    model: PROVIDER_PRESETS.openai.model,
    baseUrl: PROVIDER_PRESETS.openai.baseUrl,
    providerType: 'openai' as ProviderType,
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastRequestLog, setLastRequestLog] = useState<string | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoadingProviders(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/llm/providers`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(
          `목록 조회 실패 (status ${res.status}): ${JSON.stringify(data)}`,
        );
        return;
      }
      setProviders(data);
      console.log('[settings/provider] fetched providers', data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'provider 목록 조회 실패',
      );
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const applyPreset = (providerType: ProviderType = 'openai') => {
    const preset = PROVIDER_PRESETS[providerType] || PROVIDER_PRESETS.openai;
    const resolvedType = preset === PROVIDER_PRESETS[providerType] ? providerType : 'openai';
    setForm({
      alias: '',
      apiKey: '',
      model: preset.model,
      baseUrl: preset.baseUrl,
      providerType: resolvedType,
    });
  };

  const handleOpenModal = (providerType?: ProviderType) => {
    // event 객체가 넘어오는 경우도 있어 안전하게 문자열 검증
    const key =
      typeof providerType === 'string' &&
      (['openai'] as ProviderType[]).includes(
        providerType as ProviderType,
      )
        ? (providerType as ProviderType)
        : 'openai';
    applyPreset(key);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>,
    field: 'alias' | 'apiKey' | 'model' | 'baseUrl',
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleProviderTypeChange = (providerType: ProviderType) => {
    const preset = PROVIDER_PRESETS[providerType];
    setForm((prev) => ({
      ...prev,
      providerType,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
  };

  const handleSubmit = async () => {
    const providerLabel = PROVIDER_PRESETS[form.providerType].label;
    const payload = {
      alias: form.alias.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      baseUrl: form.baseUrl.trim(),
      providerType: form.providerType,
    };

    if (!payload.alias || !payload.apiKey) {
      setLastRequestLog('alias와 apiKey를 모두 입력해주세요.');
      return;
    }

    console.log('[settings/provider] submitting payload', payload);
    setSubmitting(true);
    setLastRequestLog(null);

    try {
      const response = await fetch(`${API_BASE_URL}/llm/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 기반 인증 토큰 전달
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);
      console.log(
        '[settings/provider] backend response',
        response.status,
        body,
      );

      setLastRequestLog(
        JSON.stringify(
          {
            endpoint: `${API_BASE_URL}/llm/providers`,
            status: response.status,
            request: payload,
            response: body,
          },
          null,
          2,
        ),
      );

      if (!response.ok) {
        // 눈에 보이는 알림: 간결하게 안내
        alert(
          `등록 실패: ${providerLabel} API Key 검증 실패\nstatus ${response.status}${
            body?.detail ? ` / ${body.detail}` : ''
          }`,
        );
        return;
      }

      setIsModalOpen(false);
      fetchProviders();
    } catch (error) {
      console.error('[settings/provider] submit failed', error);
      setLastRequestLog(
        JSON.stringify(
          {
            endpoint: `${API_BASE_URL}/llm/providers`,
            request: payload,
            error:
              error instanceof Error ? error.message : '알 수 없는 에러입니다.',
          },
          null,
          2,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/llm/providers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        alert(`삭제 실패 (status ${res.status}): ${JSON.stringify(body)}`);
        return;
      }
      fetchProviders();
    } catch (error) {
      alert(
        error instanceof Error
          ? `삭제 중 에러: ${error.message}`
          : '삭제 중 알 수 없는 에러',
      );
    }
  };

  const currentPreset = PROVIDER_PRESETS[form.providerType];

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl space-y-6 px-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            LLM provider 등록
          </h1>
          <p className="text-gray-600">
            등록된 provider 목록을 확인하고 새 provider를 추가하세요.
          </p>
          {loadError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </p>
          )}
        </div>

        {loadingProviders ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600">
            불러오는 중...
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
            아직 등록된 provider가 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {provider.provider_name}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {provider.provider_type}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      credentials: {provider.credentials.length}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      provider.is_valid
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {provider.is_valid ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(provider.id)}
                  className="mt-3 text-sm text-red-600 hover:text-red-700"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-gray-500">Provider 선택</p>
              <h3 className="text-sm font-semibold text-gray-900">
                타입을 골라 등록 폼을 열어보세요
              </h3>
              <p className="text-xs text-gray-500">
                현재는 모든 유저가 등록된 provider를 공유해서 사용합니다. (임시 방편)
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {(Object.keys(PROVIDER_PRESETS) as ProviderType[]).map((key) => {
              const preset = PROVIDER_PRESETS[key];
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleOpenModal(key)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <div className="text-sm font-semibold">{preset.label}</div>
                  <div className="text-xs text-gray-500">
                    기본 모델: {preset.model}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5" />
          Add provider
        </button>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    {currentPreset.label}
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentPreset.label} provider 추가
                  </h2>
                  <p className="text-xs text-gray-500">
                    선택한 provider 규격으로 저장됩니다. (현재는 모든 사용자가 공유 모드)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                {(Object.keys(PROVIDER_PRESETS) as ProviderType[]).map((key) => {
                  const preset = PROVIDER_PRESETS[key];
                  const active = key === form.providerType;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleProviderTypeChange(key)}
                      className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    alias (provider 이름)
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={(e) => handleChange(e, 'alias')}
                    placeholder={`예: my-${form.providerType}-provider`}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API key
                  </label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => handleChange(e, 'apiKey')}
                    placeholder={currentPreset.apiKeyHint}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    model
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => handleChange(e, 'model')}
                    placeholder={currentPreset.model}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    base URL
                  </label>
                  <input
                    type="text"
                    value={form.baseUrl}
                    onChange={(e) => handleChange(e, 'baseUrl')}
                    placeholder={currentPreset.baseUrl}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? '전송 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        )}

        {lastRequestLog && (
          <div className="rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-white">요청/응답 디버그 로그</p>
              <span className="text-xs text-gray-400">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words">
              {lastRequestLog}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
