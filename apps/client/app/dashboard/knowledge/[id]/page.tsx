'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Database,
  FileText,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Trash2,
  RotateCw,
  Bot,
  FolderOpen,
  Webhook,
  MoreVertical,
} from 'lucide-react';
import {
  knowledgeApi,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
import { SourceType } from '@/app/features/knowledge/types/Knowledge';
import CreateKnowledgeModal from '@/app/features/knowledge/components/create-knowledge-modal';
import KnowledgeSearchModal from '@/app/features/knowledge/components/knowledge-search-modal';
import ChangeEmbeddingModelModal from '@/app/features/knowledge/components/change-embedding-model-modal';
import { toast } from 'sonner';
import Link from 'next/link';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [knowledgeBase, setKnowledgeBase] =
    useState<KnowledgeBaseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Embedding Model Change Modal State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 데이터 조회
  const fetchKnowledgeBase = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) setIsLoading(true);
        const data = await knowledgeApi.getKnowledgeBase(id);
        setKnowledgeBase(data);

        // 수정 중이 아닐 때만 필드 업데이트
        if (!isEditingName) {
          setEditName(data.name);
        }
        if (!isEditingDesc) {
          setEditDesc(data.description || '');
        }
      } catch (error) {
        console.error('Failed to fetch knowledge base', error);
        alert('자료 그룹을 불러오는데 실패했습니다.');
        router.push('/dashboard/knowledge');
      } finally {
        setIsLoading(false);
      }
    },
    [id, isEditingName, isEditingDesc, router],
  );

  useEffect(() => {
    if (id) {
      fetchKnowledgeBase();
    }
  }, [id, fetchKnowledgeBase]);

  // 문서 상태 자동 갱신 (Polling)
  useEffect(() => {
    // 처리 중(indexing, processing, pending)인 자료가 존재하는지 확인
    const hasProcessingDocs = knowledgeBase?.documents.some((doc) =>
      ['indexing', 'processing', 'pending'].includes(doc.status),
    );

    // 처리 중인 자료가 있다면 3초마다 상태 갱신
    if (hasProcessingDocs) {
      const intervalId = setInterval(() => {
        fetchKnowledgeBase(true);
      }, 3000);
      return () => clearInterval(intervalId);
    }
  }, [knowledgeBase, id, fetchKnowledgeBase]);

  // 날짜 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
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
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="w-3.5 h-3.5" />
            승인 대기
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

  const handleDeleteDocument = async (documentId: string) => {
    if (
      !confirm(
        '정말로 이 문서를 삭제하시겠습니까? 파싱된 데이터도 함께 삭제됩니다.',
      )
    ) {
      return;
    }
    try {
      await knowledgeApi.deleteDocument(documentId);
      // 성공 시 목록 새로고침
      fetchKnowledgeBase();
      toast.success('자료가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('자료 삭제에 실패했습니다.');
    }
  };

  const handleSyncDocument = async (
    documentId: string,
    sourceType: SourceType,
  ) => {
    try {
      await knowledgeApi.syncDocument(id, documentId);
      fetchKnowledgeBase();
      const message =
        sourceType === 'DB'
          ? 'DB 동기화가 시작되었습니다.'
          : 'API 동기화가 시작되었습니다.';
      toast.success(message);
    } catch (error) {
      console.error('Failed to sync document:', error);
      toast.error('동기화 실패');
    }
  };

  const handleNameUpdate = async () => {
    if (!editName.trim()) {
      alert('이름은 비워둘 수 없습니다.');
      return;
    }
    if (editName === knowledgeBase?.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await knowledgeApi.updateKnowledgeBase(id, { name: editName });
      setIsEditingName(false);
      fetchKnowledgeBase();
    } catch {
      alert('이름 수정 실패');
    }
  };

  // 설명 수정 핸들러
  const handleDescUpdate = async () => {
    if (editDesc === knowledgeBase?.description) {
      setIsEditingDesc(false);
      return;
    }
    try {
      await knowledgeApi.updateKnowledgeBase(id, { description: editDesc });
      setIsEditingDesc(false);
      fetchKnowledgeBase();
    } catch {
      alert('설명 수정 실패');
    }
  };

  // 참고자료 그룹 삭제 핸들러
  const handleDeleteKnowledgeBase = async () => {
    if (deleteConfirmName !== knowledgeBase?.name) {
      toast.error('자료 그룹 이름이 일치하지 않습니다.');
      return;
    }
    try {
      setIsDeleting(true);
      await knowledgeApi.deleteKnowledgeBase(id);
      toast.success('자료 그룹이 삭제되었습니다.');
      router.push('/dashboard/knowledge');
    } catch (error) {
      console.error('Failed to delete kb:', error);
      toast.error('자료 그룹 삭제 실패');
      setIsDeleting(false);
    }
  };

  // 임베딩 모델 변경 핸들러
  const handleModelChange = async (newModel: string) => {
    try {
      await knowledgeApi.updateKnowledgeBase(id, { embedding_model: newModel });
      toast.success('임베딩 모델이 변경되었습니다. 재인덱싱이 시작됩니다.');
      fetchKnowledgeBase();
    } catch (error) {
      console.error('Failed to update embedding model:', error);
      toast.error('모델 변경 실패');
      throw error;
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
        onClick={() => router.push('/dashboard/knowledge')}
        className="flex items-center text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 mb-6 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
        목록으로 돌아가기
      </button>

      {/* Title Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Left: Icon + Title Group */}
        <div className="flex flex-1 gap-5">
          {/* Main Icon */}
          <div className="flex-shrink-0 pt-1">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
              <FolderOpen className="w-8 h-8" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Title Row */}
            <div className="flex items-center gap-2 mb-1">
              {isEditingName ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleNameUpdate}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
                  autoFocus
                  className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingName(true)}
                  className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 -ml-2 transition-colors truncate"
                  title="클릭하여 이름 수정"
                >
                  {knowledgeBase.name}
                </h1>
              )}
            </div>

            {/* Description Row */}
            <div className="mb-1">
              {isEditingDesc ? (
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onBlur={handleDescUpdate}
                  onKeyDown={(e) => e.key === 'Enter' && handleDescUpdate()}
                  autoFocus
                  placeholder="설명을 입력하세요"
                  className="text-gray-500 dark:text-gray-400 bg-transparent border-b border-blue-500 focus:outline-none w-full"
                />
              ) : (
                <p
                  onClick={() => setIsEditingDesc(true)}
                  className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 -ml-2 transition-colors truncate ${
                    knowledgeBase.description
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-500 italic'
                  }`}
                  title="클릭하여 설명 수정"
                >
                  {knowledgeBase.description || '설명을 입력하세요'}
                </p>
              )}
            </div>
            {/* Metadata Row */}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <button
                onClick={() => setIsModelModalOpen(true)}
                className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group relative"
                title="클릭하여 모델 변경"
              >
                <Settings className="w-4 h-4" />
                <span>
                  모델:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {knowledgeBase.embedding_model}
                  </span>
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -right-5 text-xs">
                  ✏️
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4 pt-1">
          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-1"
              title="더보기"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 z-20 overflow-hidden py-1">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    자료 그룹 삭제
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg transition-colors mr-2 shadow-sm"
          >
            <Bot className="w-5 h-5 mr-1.5 text-blue-600 dark:text-blue-400" />
            AI 답변 테스트
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            자료 추가
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            자료 목록
            <span className="ml-2 text-sm font-normal text-gray-500 bg-white dark:bg-gray-600 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-500">
              {knowledgeBase.documents.length}개
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-4 w-24">종류</th>
                <th className="px-6 py-4">파일명 / 소스명</th>
                <th className="px-6 py-4">상태</th>
                <th className="px-6 py-4">청크 수</th>
                <th className="px-6 py-4">업데이트 일시</th>
                <th className="px-6 py-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {knowledgeBase.documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-gray-900 dark:text-gray-200 font-medium mb-1">
                        아직 등록된 자료가 없습니다.
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        AI가 학습할 문서를 추가해보세요.
                      </p>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />첫 번째 자료 추가하기
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                knowledgeBase.documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {doc.source_type === 'DB' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 text-xs font-semibold border border-purple-100 dark:border-purple-800">
                          <Database className="w-3.5 h-3.5" />
                          DB
                        </div>
                      ) : doc.source_type === 'API' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 text-xs font-semibold border border-green-100 dark:border-green-800">
                          <Webhook className="w-3.5 h-3.5" />
                          API
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs font-semibold border border-blue-100 dark:border-blue-800">
                          <FileText className="w-3.5 h-3.5" />
                          FILE
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white max-w-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/knowledge/${knowledgeBase.id}/document/${doc.id}`}
                          className="hover:text-blue-600 hover:underline truncate"
                        >
                          {doc.filename}
                        </Link>
                      </div>
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
                      {formatDate(doc.updated_at || doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        {doc.source_type &&
                          ['API', 'DB'].includes(doc.source_type) && (
                            <>
                              <button
                                className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                onClick={() =>
                                  handleSyncDocument(
                                    doc.id,
                                    doc.source_type as SourceType,
                                  )
                                }
                                title="최신 데이터 동기화"
                              >
                                <RotateCw className="h-4 w-4" />
                              </button>
                              <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-3" />
                            </>
                          )}
                        <button
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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

      {/* Search Test Modal */}
      <KnowledgeSearchModal
        isOpen={isSearchModalOpen}
        knowledgeBaseId={id}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                자료 그룹 삭제
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-300">
                <p className="font-semibold mb-1">경고: 복구할 수 없습니다.</p>
                <p>
                  삭제하시려면 자료 그룹 이름{' '}
                  <span className="font-bold underline">
                    {knowledgeBase.name}
                  </span>
                  과 똑같이 입력해주세요.
                </p>
              </div>

              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                placeholder="자료 그룹 이름 입력"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteKnowledgeBase}
                  disabled={
                    deleteConfirmName !== knowledgeBase.name || isDeleting
                  }
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      삭제 중...
                    </>
                  ) : (
                    '삭제 확인'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedding Model Change Modal */}
      <ChangeEmbeddingModelModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        currentModel={knowledgeBase?.embedding_model || ''}
        onConfirm={handleModelChange}
      />
    </div>
  );
}
