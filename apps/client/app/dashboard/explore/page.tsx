'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { appApi, App } from '@/app/features/app/api/appApi';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const data = await appApi.listApps();
        setApps(data);
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          탐색
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          커뮤니티에서 만든 모듈을 탐색하고 사용해보세요
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="모듈 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map((app) => (
          <div
            key={app.id}
            className="group flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
          >
            {/* Module Info */}
            <div className="flex-1">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                {app.icon ? (
                  <span className="text-xl">{app.icon}</span>
                ) : (
                  <div className="h-full w-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {app.name}
              </h3>
              <p className="mt-2 text-sm text-gray-600 line-clamp-2 dark:text-gray-400">
                {app.description || '설명이 없습니다.'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredModules.length === 0 && searchQuery && (
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            &quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
