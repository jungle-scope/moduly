'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Database, Calendar, FileText } from 'lucide-react';
import CreateKnowledgeModal from '@/app/features/knowledge/components/create-knowledge-modal';
import {
  knowledgeApi,
  KnowledgeBaseResponse,
} from '@/app/features/knowledge/api/knowledgeApi';

export default function KnowledgePage() {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseResponse[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 데이터 조회 함수
  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true);
      const data = await knowledgeApi.getKnowledgeBases();
      setKnowledgeBases(data);
    } catch (error) {
      console.error('Failed to fetch knowledge bases', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 로딩 및 모달 닫힐 때 데이터 갱신
  useEffect(() => {
    fetchKnowledgeBases();
  }, [isCreateModalOpen]); // 모달이 닫히면(생성되면) 목록 갱신

  const filteredKnowledge = knowledgeBases.filter((kb) =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="참고자료 그룹을 검색하세요"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        {/* 리스트가 없을 때만 우상단 버튼 표시됨 */}
        {knowledgeBases.length > 0 && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            참고 자료 생성
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredKnowledge.length === 0 ? (
        // Empty State
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Database className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            참고자료 그룹이 없습니다
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            새로운 참고자료를 생성해보세요.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              참고자료 생성
            </button>
          </div>
        </div>
      ) : (
        // List View
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {filteredKnowledge.map((kb, index) => (
            <div
              key={kb.id}
              onClick={() => router.push(`/dashboard/knowledge/${kb.id}`)}
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
                  {kb.description || '설명 없음'}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                <div className="flex items-center gap-1.5" title="문서 개수">
                  <FileText className="w-4 h-4" />
                  <span>{kb.document_count}개 문서</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(kb.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <CreateKnowledgeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
