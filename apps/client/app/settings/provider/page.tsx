'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

type Provider = {
  id: string;
  name: string;
  model: string;
  status: 'active' | 'inactive';
};

const mockProviders: Provider[] = [];

export default function SettingsProviderPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    alias: '',
    apiKey: '',
  });

  const handleOpenModal = () => {
    setForm({ alias: '', apiKey: '' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'alias' | 'apiKey',
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    // 서버 연동 없이 UI만: 제출 시 모달 닫기
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    // 서버 연동 없이 UI만: 자리만 표시
    console.log('delete provider', id);
  };

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
        </div>

        {mockProviders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
            아직 등록된 provider가 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mockProviders.map((provider) => (
              <div
                key={provider.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {provider.name}
                    </h2>
                    <p className="text-sm text-gray-600">{provider.model}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      provider.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {provider.status === 'active' ? 'Active' : 'Inactive'}
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

        <button
          type="button"
          onClick={handleOpenModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5" />
          Add provider
        </button>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  새 provider 추가
                </h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    model 이름 (별칭)
                  </label>
                  <input
                    type="text"
                    value={form.alias}
                    onChange={(e) => handleChange(e, 'alias')}
                    placeholder="예: my-gpt-4o"
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
                    placeholder="sk-***"
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
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
