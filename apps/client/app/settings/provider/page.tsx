'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Plus, Trash2, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

// Types matching backend response
type LLMModelResponse = {
  id: string;
  name: string;
};

type LLMProviderResponse = {
  id: string;
  name: string;
  description?: string;
  type: string;
  base_url: string;
  doc_url?: string;
  models: LLMModelResponse[];
};

type LLMCredentialResponse = {
  id: string;
  provider_id: string;
  credential_name: string;
  config_preview?: string;
  is_valid: boolean;
  created_at: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export default function SettingsProviderPage() {
  const [providers, setProviders] = useState<LLMProviderResponse[]>([]);
  const [credentials, setCredentials] = useState<LLMCredentialResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [form, setForm] = useState({
    alias: '',
    apiKey: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch System Providers
      const provRes = await fetch(`${API_BASE_URL}/llm/providers`, { credentials: 'include' });
      const provData = await provRes.json();
      if (!provRes.ok) throw new Error(provData.detail || 'Failed to fetch providers');
      setProviders(provData);

      // 2. Fetch User Credentials
      // Backend extracts user_id from auth cookie
      const credRes = await fetch(`${API_BASE_URL}/llm/credentials`, { credentials: 'include' });
      const credData = await credRes.json();
      if (!credRes.ok) throw new Error(credData.detail || 'Failed to fetch credentials');
      setCredentials(credData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (providerId: string) => {
    setSelectedProviderId(providerId);
    setForm({ alias: '', apiKey: '' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.alias || !form.apiKey) {
      alert('이름과 API Key를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        provider_id: selectedProviderId,
        credential_name: form.alias,
        api_key: form.apiKey,
        // Backend handles user_id from session
      };

      const res = await fetch(`${API_BASE_URL}/llm/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Registration failed');
      }

      alert('API Key가 성공적으로 등록되었습니다.');
      setIsModalOpen(false);
      fetchData(); // Refresh list
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (credId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      // Backend handles user_id from session
      const res = await fetch(`${API_BASE_URL}/llm/credentials/${credId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl space-y-8 px-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM Provider 설정</h1>
          <p className="text-gray-600 mt-1">
            시스템이 지원하는 Provider에 본인의 API Key를 등록하여 사용하세요.
          </p>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
            </div>
        )}

        {loading ? (
             <div className="text-center py-10 text-gray-500">로딩 중...</div>
        ) : (
            <div className="grid gap-6">
                {providers.map(provider => {
                    const myCreds = credentials.filter(c => c.provider_id === provider.id);
                    
                    return (
                        <div key={provider.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold text-gray-900 capitalize">{provider.name}</h2>
                                        {myCreds.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Connected</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{provider.description}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="text-xs text-gray-400 flex gap-2">
                                            <span>Base URL: {provider.base_url}</span>
                                            <span>•</span>
                                            <span>Models: {provider.models.length}개 지원 ({provider.models.slice(0,3).map(m=>m.name).join(', ')}{provider.models.length > 3 ? '...' : ''})</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button
                                        onClick={() => handleOpenModal(provider.id)}
                                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-md hover:bg-gray-800 transition-colors whitespace-nowrap"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        API Key 등록
                                    </button>
                                    {provider.doc_url && (
                                        <a 
                                            href={provider.doc_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-600 hover:underline"
                                            title="API 키 발급 받고 오기"
                                        >
                                            Get API Key <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Credentials List */}
                            <div className="bg-gray-50/50 px-6 py-3">
                                {myCreds.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">등록된 API Key가 없습니다.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {myCreds.map(cred => (
                                            <div key={cred.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-full ${cred.is_valid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {cred.is_valid ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{cred.credential_name}</p>
                                                        <p className="text-xs text-gray-400 font-mono">{cred.config_preview}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelete(cred.id)}
                                                    className="text-gray-400 hover:text-red-600 p-1"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">API Key 등록</h2>
                <p className="text-sm text-gray-500 mt-1">
                   {providers.find(p => p.id === selectedProviderId)?.name} 설정을 추가합니다.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    별칭 (Alias)
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={(e) => setForm(prev => ({ ...prev, alias: e.target.value }))}
                    placeholder="예: 회사용 키, 개인용 키"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => setForm(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder={(() => {
                            const pName = providers.find(p => p.id === selectedProviderId)?.name.toLowerCase() || '';
                            if (pName.includes('google')) return 'AIza...';
                            if (pName.includes('anthropic')) return 'sk-ant-...';
                            return 'sk-...';
                        })()}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    키 등록 시, 사용 가능한 모델 목록을 자동으로 가져옵니다.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={handleCloseModal}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {submitting ? '등록 및 동기화 중...' : '등록하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

