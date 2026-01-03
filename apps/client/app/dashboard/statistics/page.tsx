'use client';

import { useState } from 'react';
import { MonitoringTab } from './components/MonitoringTab';
import { LogTab } from './components/LogTab';

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'logs'>('monitoring');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          통계
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          모듈 사용 현황과 통계를 확인하세요
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-8 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === 'monitoring'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300'
            }`}
          >
            모니터링
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300'
            }`}
          >
            로그
          </button>
        </nav>
      </div>


      {/* 탭 컨텐츠 */}
      {activeTab === 'monitoring' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <MonitoringTab />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-[calc(100vh-200px)]">
           <LogTab />
        </div>
      )}
    </div>
  );
}

