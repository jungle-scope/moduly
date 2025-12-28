'use client';

import { useState } from 'react';
import { Search, Plus, Database, FileText, Calendar } from 'lucide-react';
import CreateKnowledgeModal from '@/app/features/knowledge/components/create-knowledge-modal';

// 임시 데이터
const mockKnowledgeBases = [
  {
    id: 1,
    name: '제품 매뉴얼',
    description: '모듈리 제품 사용법 및 가이드 문서 모음',
    updatedAt: '2025-12-25',
  },
  {
    id: 2,
    name: '고객 응대 시나리오',
    description: 'CS 팀을 위한 상황별 응대 스크립트',
    updatedAt: '2025-12-24',
  },
  {
    id: 3,
    name: '기술 블로그 아카이브',
    description: '엔지니어링 팀 기술 블로그 포스트',
    updatedAt: '2025-12-20',
  },
];

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredKnowledge = mockKnowledgeBases.filter((kb) =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          지식
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          AI가 활용할 지식 베이스를 관리하세요.
        </p>
      </div>

      {/* Actions Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="지식 베이스 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 transition-shadow"
          />
        </div>

        {/* Create Button (Right Aligned) */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>지식 생성</span>
        </button>
      </div>

      {/* List View */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {filteredKnowledge.map((kb, index) => (
          <div
            key={kb.id}
            className={`group flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
              index !== filteredKnowledge.length - 1
                ? 'border-b border-gray-200 dark:border-gray-700'
                : ''
            }`}
          >
            {/* Icon */}
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {kb.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {kb.description}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 shrink-0">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{kb.updatedAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <CreateKnowledgeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
