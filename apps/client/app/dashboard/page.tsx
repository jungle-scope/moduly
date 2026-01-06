'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';

import CreateAppModal from '../features/app/components/create-app-modal';
import EditAppModal from '../features/app/components/edit-app-modal';
import AppCard from '../features/app/components/app-card';
import { appApi, type App } from '../features/app/api/appApi';

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadApps();

    // 사이드바에서 앱 생성 모달 이벤트 수신
    const handleOpenModal = () => {
      setIsCreateModalOpen(true);
    };

    window.addEventListener('openCreateAppModal', handleOpenModal);
    return () =>
      window.removeEventListener('openCreateAppModal', handleOpenModal);
  }, []);

  const loadApps = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await appApi.listApps();
      setApps(data);
    } catch (err) {
      setError('앱 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppClick = (app: App) => {
    // workflow_id가 있으면 그것으로, 없으면 app_id로 이동
    const targetId = app.workflow_id || app.id;
    router.push(`/workflows/${targetId}`);
  };

  const handleCreateApp = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditApp = (e: React.MouseEvent, app: App) => {
    e.stopPropagation();
    setEditingApp(app);
  };

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-8 bg-gradient-to-br from-white via-gray-50 to-gray-100 min-h-full border border-gray-200">
      {/* 페이지 제목 */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h1>

      {/* 검색 및 생성 행 */}
      <div className="mb-6 flex items-center justify-end gap-3">
        {/* 검색바 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search for projects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={handleCreateApp}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">로딩 중...</p>
        </div>
      )}

      {/* 모듈 카드 그리드 */}
      {/* 앱 그리드 */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 기존 앱 카드 */}
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onClick={handleAppClick}
              onEdit={handleEditApp}
            />
          ))}
        </div>
      )}

      {/* 검색 결과 없음 상태 */}
      {!isLoading && filteredApps.length === 0 && searchQuery && (
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            &quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.
          </p>
        </div>
      )}

      {/* 앱 생성 모달 */}
      {isCreateModalOpen && (
        <CreateAppModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadApps(); // 목록 새로고침
          }}
        />
      )}

      {/* 앱 수정 모달 */}
      {editingApp && (
        <EditAppModal
          app={editingApp}
          onClose={() => setEditingApp(null)}
          onSuccess={() => {
            setEditingApp(null);
            loadApps(); // 목록 새로고침
          }}
        />
      )}
    </div>
  );
}
