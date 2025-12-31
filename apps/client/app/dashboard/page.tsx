'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Pencil } from 'lucide-react';

import CreateAppModal from '../features/app/components/create-app-modal';
import EditAppModal from '../features/app/components/edit-app-modal';
import LogoutButton from '../features/auth/components/LogoutButton';
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
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            스튜디오
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            모듈을 생성하고 편집하는 공간입니다.
          </p>
        </div>
        <LogoutButton />
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

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      )}

      {/* Module Cards Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Create Module Button */}
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

          {/* Existing App Cards */}
          {filteredApps.map((app) => (
            <div
              key={app.id}
              onClick={() => handleAppClick(app)}
              className="group flex min-h-[200px] cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
            >
              {/* Header: Title + Icon */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {app.name}
                  </h3>
                  {app.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {app.description}
                    </p>
                  )}
                </div>

                {/* Large Icon */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 ml-4"
                  style={{ backgroundColor: app.icon_background }}
                >
                  {app.icon}
                </div>
              </div>

              {/* Tag */}
              <div className="mt-auto">
                <span className="inline-block px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md dark:bg-blue-900 dark:text-blue-300">
                  App
                </span>
              </div>

              {/* Footer: Meta Info */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <p className="text-xs text-gray-400">
                  수정: {new Date(app.updated_at).toLocaleDateString('ko-KR')}
                </p>
                <button
                  onClick={(e) => handleEditApp(e, app)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                  title="앱 정보 수정"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Empty State */}
      {!isLoading && filteredApps.length === 0 && searchQuery && (
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            &quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.
          </p>
        </div>
      )}

      {/* Create App Modal */}
      {isCreateModalOpen && (
        <CreateAppModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadApps(); // 목록 새로고침
          }}
        />
      )}

      {/* Edit App Modal */}
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
