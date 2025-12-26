// 임시 탐색 페이지, 목데이터로 구성

'use client';

import { useState } from 'react';
import { Search, Star, Download } from 'lucide-react';

// 임시 마켓플레이스 모듈 데이터
const mockMarketplaceModules = [
  {
    id: 1,
    name: 'GPT-4 텍스트 요약기',
    description: 'OpenAI GPT-4를 사용하여 긴 텍스트를 자동으로 요약합니다',
    author: 'AI Team',
    downloads: 1234,
    rating: 4.8,
    category: 'AI/ML',
  },
  {
    id: 2,
    name: '이메일 자동 분류',
    description: '받은 이메일을 자동으로 카테고리별로 분류하고 라벨링합니다',
    author: 'Productivity Labs',
    downloads: 856,
    rating: 4.6,
    category: '자동화',
  },
  {
    id: 3,
    name: '데이터 시각화 대시보드',
    description: 'CSV 데이터를 자동으로 분석하고 차트로 시각화합니다',
    author: 'Data Viz Pro',
    downloads: 2341,
    rating: 4.9,
    category: '데이터',
  },
  {
    id: 4,
    name: 'Slack 알림 봇',
    description: '중요한 이벤트 발생 시 Slack으로 자동 알림을 보냅니다',
    author: 'DevOps Team',
    downloads: 1567,
    rating: 4.7,
    category: '알림',
  },
  {
    id: 5,
    name: '웹 스크래핑 도구',
    description: '웹사이트에서 데이터를 자동으로 수집하고 정리합니다',
    author: 'Web Scraper Inc',
    downloads: 987,
    rating: 4.5,
    category: '데이터',
  },
  {
    id: 6,
    name: '번역 자동화',
    description: '다국어 번역을 자동으로 처리하고 결과를 저장합니다',
    author: 'Language AI',
    downloads: 1876,
    rating: 4.8,
    category: 'AI/ML',
  },
];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = mockMarketplaceModules.filter(
    (module) =>
      module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        {filteredModules.map((module) => (
          <div
            key={module.id}
            className="group flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
          >
            {/* Category Badge */}
            <div className="mb-3">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {module.category}
              </span>
            </div>

            {/* Module Info */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {module.name}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {module.description}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                by {module.author}
              </p>
            </div>

            {/* Stats */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{module.rating}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Download className="h-4 w-4" />
                <span>{module.downloads.toLocaleString()}</span>
              </div>
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
