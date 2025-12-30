'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Database,
  FileText,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
} from 'lucide-react';
import {
  knowledgeApi,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
import CreateKnowledgeModal from '@/app/features/knowledge/components/create-knowledge-modal';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [knowledgeBase, setKnowledgeBase] =
    useState<KnowledgeBaseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // 데이터 조회
  const fetchKnowledgeBase = async () => {
    try {
      setIsLoading(true);
      const data = await knowledgeApi.getKnowledgeBase(id);
      setKnowledgeBase(data);
    } catch (error) {
      console.error('Failed to fetch knowledge base', error);
      alert('지식 베이스를 불러오는데 실패했습니다.');
      router.push('/dashboard/knowledge');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchKnowledgeBase();
    }
  }, [id]);

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 상태 뱃지 렌더링
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            완료
          </span>
        );
      case 'indexing':
      case 'processing': // processing도 indexing으로 취급
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            처리중
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            실패
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            대기중
          </span>
        );
    }
  };

  if (isLoading || !knowledgeBase) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Navigation */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로 돌아가기
      </button>

      {/* Title Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            {knowledgeBase.name}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-3xl">
            {knowledgeBase.description || '설명 없음'}
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              <Calendar className="w-4 h-4" />
              <span>생성: {formatDate(knowledgeBase.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              <Settings className="w-4 h-4" />
              <span>모델: {knowledgeBase.embedding_model}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          문서 추가
        </button>
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            문서 목록
            <span className="ml-2 text-sm font-normal text-gray-500 bg-white dark:bg-gray-600 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-500">
              {knowledgeBase.documents.length}개
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-4">파일명</th>
                <th className="px-6 py-4">상태</th>
                <th className="px-6 py-4">청크 수</th>
                <th className="px-6 py-4">업로드 일시</th>
                <th className="px-6 py-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {knowledgeBase.documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 opacity-20" />
                      <p>아직 등록된 문 서가 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                knowledgeBase.documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {doc.filename}
                      {doc.error_message && (
                        <p
                          className="text-xs text-red-500 mt-1 max-w-md truncate"
                          title={doc.error_message}
                        >
                          {doc.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {renderStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {doc.chunk_count > 0
                        ? `${doc.chunk_count.toLocaleString()}개`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* 추후 삭제 버튼 등 추가 예정 */}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal (Reuse) - TODO: KB ID 전달 필요 */}
      <CreateKnowledgeModal
        isOpen={isUploadModalOpen}
        knowledgeBaseId={id}
        onClose={() => {
          setIsUploadModalOpen(false);
          fetchKnowledgeBase(); // 모달 닫히면 데이터 갱신
        }}
      />
    </div>
  );
}
