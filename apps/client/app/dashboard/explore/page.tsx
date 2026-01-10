'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Copy, Maximize } from 'lucide-react';
import { appApi, App } from '@/app/features/app/api/appApi';
import { toast } from 'sonner';
import { AppGraphModal } from './components/AppGraphModal';

interface AppWithStats extends App {
  rating: number;
  downloadCount: number;
}

export default function ExplorePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState<AppWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [selectedAppForGraph, setSelectedAppForGraph] = useState<App | null>(
    null,
  );

  const handleClone = async (e: React.MouseEvent, appId: string) => {
    e.stopPropagation();
    if (cloningId) return;

    try {
      setCloningId(appId);
      await appApi.cloneApp(appId);
      toast.success('앱이 성공적으로 복제되었습니다.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to clone app:', error);
      toast.error('앱 복제에 실패했습니다.');
    } finally {
      setCloningId(null);
    }
  };

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const data = await appApi.getExploreApps();
        const appsWithStats = data.map((app) => ({
          ...app,
          rating: (Math.floor(Math.random() * 41) + 10) / 10, // 1.0 to 5.0
          downloadCount: Math.floor(Math.random() * 10001), // 0 to 10000
        }));
        setApps(appsWithStats);
      } catch (error) {
        console.error('Failed to fetch apps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApps();
  }, []);

  const filteredModules = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.description &&
        app.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-white via-gray-50 to-gray-100 min-h-full border border-gray-200">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">마켓플레이스</h1>

      {/* 검색창 */}
      <div className="mb-6 flex items-center justify-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="모듈 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* 모듈 카드 그리드 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map((app) => (
          <div
            key={app.id}
            className="group flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
          >
            {/* 모듈 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: app.icon?.background_color || '#f3f4f6',
                  }}
                >
                  {app.icon?.content ? (
                    <span className="text-xl">{app.icon.content}</span>
                  ) : (
                    <div className="h-full w-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 truncate">
                    {app.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 text-yellow-400 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {app.rating.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {app.downloadCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600 line-clamp-2 dark:text-gray-400">
                {app.description || '설명이 없습니다.'}
              </p>
            </div>

            {/* 작업 푸터 */}
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAppForGraph(app);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white"
              >
                <Maximize className="h-4 w-4" />
                내부 정보
              </button>
              <button
                onClick={(e) => handleClone(e, app.id)}
                disabled={cloningId === app.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
              >
                {cloningId === app.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {cloningId === app.id ? '복제 중...' : '복제하기'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 빈 상태 */}
      {filteredModules.length === 0 && searchQuery && (
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            &quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.
          </p>
        </div>
      )}

      {/* 상세 정보 모달 */}
      {selectedAppForGraph && (
        <AppGraphModal
          isOpen={true}
          onClose={() => setSelectedAppForGraph(null)}
          app={selectedAppForGraph}
        />
      )}
    </div>
  );
}
