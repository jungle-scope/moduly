'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';

// 임시 데이터 (나중에 API로 대체)
const mockApps = [
  {
    id: 1,
    name: '고객 지원 챗봇',
    description: 'AI 기반 고객 응대 시스템',
    updatedAt: '2025-12-20',
  },
  {
    id: 2,
    name: '데이터 분석 워크플로우',
    description: '자동 데이터 처리 및 리포트 생성',
    updatedAt: '2025-12-19',
  },
  {
    id: 3,
    name: '이메일 자동화',
    description: '스마트 이메일 분류 및 응답',
    updatedAt: '2025-12-18',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredApps = mockApps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateApp = () => {
    // TODO: 백엔드 API 연동 필요
    // 1. POST /api/workflows - 새 워크플로우 생성
    // 2. 생성된 워크플로우 ID 받아오기
    // 3. router.push(`/workflows/${id}`)로 이동

    // 임시: 대시보드 메인 페이지로 이동
    router.push('/dashboard');
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          스튜디오
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          모듈을 생성하고 편집하는 공간입니다.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="모듈 이름 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* module Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Create module */}
        <button
          onClick={handleCreateApp}
          className="group flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500 dark:hover:bg-gray-800"
        >
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-blue-100 dark:bg-gray-800 dark:group-hover:bg-blue-900">
            <Plus className="h-8 w-8 text-gray-400 transition-colors group-hover:text-blue-600 dark:text-gray-500 dark:group-hover:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            모듈 만들기
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            새로운 모듈 생성
          </p>
        </button>

        {/* Existing module Cards */}
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className="group flex min-h-[200px] cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
          >
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {app.name}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {app.description}
              </p>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                마지막 수정: {app.updatedAt}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredApps.length === 0 && searchQuery && (
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            &quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
