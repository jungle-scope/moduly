'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Database,
  FileText,
  Webhook,
  Clock,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
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
  const [initialTab, setInitialTab] = useState<
    'FILE' | 'API' | 'DB' | undefined
  >(undefined);

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

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreate = (tab?: 'FILE' | 'API' | 'DB') => {
    setInitialTab(tab);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="p-8 bg-white min-h-full">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">지식 관리</h1>
      {/* Actions Section */}
      <div className="flex flex-col md:flex-row justify-end items-center gap-3 mb-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="지식 베이스 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={() => handleCreate()}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          title="새 지식 베이스 만들기"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />새 지식
          베이스
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        // List View
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {filteredKnowledge.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              등록된 지식 베이스가 없습니다.
            </div>
          ) : (
            filteredKnowledge.map((kb, index) => (
              <div
                key={kb.id}
                onClick={() => router.push(`/dashboard/knowledge/${kb.id}`)}
                className={`group flex items-center gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer ${
                  index !== filteredKnowledge.length - 1
                    ? 'border-b border-gray-200 dark:border-gray-700'
                    : ''
                }`}
              >
                {/* Left: Folder Icon */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                  <FolderOpen className="w-6 h-6" />
                </div>

                {/* Center: Content */}
                <div className="flex-1 min-w-0 ml-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {kb.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                    {kb.description || '설명 없음'}
                  </p>

                  {/* Bottom: Metadata Row */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {/* Source Types */}
                    {kb.source_types && kb.source_types.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1.5">
                          {kb.source_types.map((type, idx) => {
                            if (type === 'FILE')
                              return (
                                <div
                                  key={idx}
                                  className="relative z-10 bg-white dark:bg-gray-800 rounded-full p-0.5"
                                  title="파일"
                                >
                                  <div className="bg-blue-100 dark:bg-blue-900 p-1 rounded-full">
                                    <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                              );
                            if (type === 'API')
                              return (
                                <div
                                  key={idx}
                                  className="relative z-10 bg-white dark:bg-gray-800 rounded-full p-0.5"
                                  title="API"
                                >
                                  <div className="bg-green-100 dark:bg-green-900 p-1 rounded-full">
                                    <Webhook className="w-3 h-3 text-green-600 dark:text-green-400" />
                                  </div>
                                </div>
                              );
                            if (type === 'DB')
                              return (
                                <div
                                  key={idx}
                                  className="relative z-10 bg-white dark:bg-gray-800 rounded-full p-0.5"
                                  title="DB"
                                >
                                  <div className="bg-purple-100 dark:bg-purple-900 p-1 rounded-full">
                                    <Database className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                  </div>
                                </div>
                              );
                            return null;
                          })}
                        </div>
                        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></span>
                      </div>
                    )}

                    {/* Count */}
                    <span>자료 {kb.document_count}개</span>

                    {/* Time */}
                    {kb.updated_at && (
                      <>
                        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatRelativeTime(kb.updated_at)} 업데이트
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Chevron */}
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      <CreateKnowledgeModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setInitialTab(undefined);
        }}
        initialTab={initialTab}
      />
    </div>
  );
}
