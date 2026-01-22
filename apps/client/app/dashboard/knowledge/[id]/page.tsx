'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Database,
  FileText,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Trash2,
  // RotateCw,
  Bot,
  FolderOpen,
  Webhook,
  Home,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import {
  knowledgeApi,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
// import { SourceType } from '@/app/features/knowledge/types/Knowledge';
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

  // Delete Modal State (Knowledge Base)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Modal State (Source/Document)
  const [isSourceDeleteModalOpen, setIsSourceDeleteModalOpen] = useState(false);
  const [deleteTargetDocId, setDeleteTargetDocId] = useState<string | null>(
    null,
  );
  const [isDeletingSource, setIsDeletingSource] = useState(false);

  // Embedding Model Change Modal State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

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

  // 날짜 포맷팅 (상세)
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

  // 상대 시간 포맷팅
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // 파일명에서 확장자 추출
  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts.pop()?.toUpperCase() || '';
    }
    return '';
  };

  // UUID prefix가 있으면 제거, API URL이면 "API: 도메인" 형식으로 변환
  const getDisplayFilename = (filename: string): string => {
    // API source: URL이면 도메인만 추출
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      try {
        const url = new URL(filename);
        return url.hostname;
      } catch {
        return filename;
      }
    }
    // FILE source: UUID prefix 제거
    if (filename.length > 37 && filename[36] === '_') {
      return filename.substring(37);
    }
    // DB source 등: 그대로 반환
    return filename;
  };

  // 확장자 제거한 파일명 (중간 생략 처리, 한글 안전)
  const getTruncatedFilename = (filename: string, maxLength = 30) => {
    // UUID prefix 제거
    const cleanFilename = getDisplayFilename(filename);
    const ext = getFileExtension(cleanFilename);
    const nameWithoutExt = ext
      ? cleanFilename.slice(0, -(ext.length + 1))
      : cleanFilename;

    // NFC 정규화 (한글 분해형 -> 조합형)
    const normalized = nameWithoutExt.normalize('NFC');

    if (normalized.length <= maxLength) return normalized;

    const halfLen = Math.floor(maxLength / 2) - 2;
    const start = normalized.slice(0, halfLen);
    const end = normalized.slice(-halfLen);
    return `${start}...${end}`;
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
    setDeleteTargetDocId(documentId);
    setIsSourceDeleteModalOpen(true);
  };

  const confirmDeleteDocument = async () => {
    if (!deleteTargetDocId) return;
    try {
      setIsDeletingSource(true);
      await knowledgeApi.deleteDocument(deleteTargetDocId);
      fetchKnowledgeBase();
      toast.success('소스가 삭제되었습니다.');
      setIsSourceDeleteModalOpen(false);
      setDeleteTargetDocId(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('소스 삭제에 실패했습니다.');
    } finally {
      setIsDeletingSource(false);
    }
  };

  // const handleSyncDocument = async (
  //   documentId: string,
  //   sourceType: SourceType,
  // ) => {
  //   try {
  //     await knowledgeApi.syncDocument(id, documentId);
  //     fetchKnowledgeBase();
  //     const message =
  //       sourceType === 'DB'
  //         ? 'DB 동기화가 시작되었습니다.'
  //         : 'API 동기화가 시작되었습니다.';
  //     toast.success(message);
  //   } catch (error) {
  //     console.error('Failed to sync document:', error);
  //     toast.error('동기화 실패');
  //   }
  // };

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

  // 지식 베이스 삭제 핸들러
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
    <div className="p-8 bg-gray-50/30 dark:bg-gray-900 min-h-full">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>홈</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
        <Link
          href="/dashboard/knowledge"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          지식 관리
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
        <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[200px]">
          {knowledgeBase.name}
        </span>
      </nav>

      {/* Title Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Left: Icon + Title Group */}
        <div className="flex flex-1 gap-5">
          {/* Main Icon */}
          <div className="shrink-0">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-center gap-2 mb-0.5">
              {isEditingName ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleNameUpdate}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
                  autoFocus
                  className="text-base font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingName(true)}
                  className="text-base font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -ml-1 transition-colors truncate"
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
                  className={`text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -ml-1 transition-colors truncate ${
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

            {/* Model Badge - Clean Badge UI */}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setIsModelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full border border-gray-200 dark:border-gray-600 transition-colors"
                title="클릭하여 모델 변경"
              >
                <Cpu className="w-3.5 h-3.5 text-blue-500" />
                <span>{knowledgeBase.embedding_model}</span>
                <Settings className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons - Horizontal Layout */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-white text-sm rounded-lg transition-colors shadow-sm"
          >
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            AI 답변 테스트
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            소스 추가
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      </div>

      {/* Source List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-500" />
            소스 목록
            <span className="ml-1 text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
              {knowledgeBase.documents.length}개
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                <th className="px-5 py-2.5 w-20">종류</th>
                <th className="px-5 py-2.5">파일명 / 소스명</th>
                <th className="px-5 py-2.5">상태</th>
                <th className="px-5 py-2.5">청크 수</th>
                <th className="px-5 py-2.5">업데이트 일시</th>
                <th className="px-5 py-2.5 text-right">작업</th>
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
                        <Plus className="w-4 h-4 mr-1.5" />
                        첫번째 소스 추가하기
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
                    <td className="px-5 py-2.5">
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
                    <td className="px-5 py-2.5 font-medium text-sm text-gray-900 dark:text-white max-w-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/knowledge/${knowledgeBase.id}/document/${doc.id}`}
                          className="hover:text-blue-600 hover:underline truncate"
                          title={doc.filename}
                        >
                          {getTruncatedFilename(doc.filename)}
                        </Link>
                        {doc.source_type !== 'API' &&
                          doc.source_type !== 'DB' &&
                          getFileExtension(
                            getDisplayFilename(doc.filename),
                          ) && (
                            <span className="shrink-0 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-semibold rounded uppercase">
                              {getFileExtension(
                                getDisplayFilename(doc.filename),
                              )}
                            </span>
                          )}
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
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {renderStatusBadge(doc.status)}
                        {/* {doc.source_type &&
                          ['API', 'DB'].includes(doc.source_type) && (
                            <button
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                              onClick={() =>
                                handleSyncDocument(
                                  doc.id,
                                  doc.source_type as SourceType,
                                )
                              }
                              title="최신 데이터 동기화"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                          )} */}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-gray-500 text-xs">
                      {doc.chunk_count > 0
                        ? `${doc.chunk_count.toLocaleString()}개`
                        : '-'}
                    </td>
                    <td
                      className="px-5 py-2.5 text-gray-500 text-xs cursor-default"
                      title={formatDate(doc.updated_at || doc.created_at)}
                    >
                      {formatRelativeTime(doc.updated_at || doc.created_at)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        onClick={() => handleDeleteDocument(doc.id)}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                지식 베이스 삭제
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
                <p className="font-semibold mb-2">
                  ⚠️ 경고: 복구할 수 없습니다.
                </p>
                <p>삭제하시려면 지식 베이스 이름을 정확히 입력해주세요:</p>
                <p className="mt-2 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800 font-bold text-red-700 dark:text-red-300">
                  {knowledgeBase.name}
                </p>
              </div>

              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                placeholder="지식 베이스 이름 입력"
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

      {/* Source Delete Confirmation Modal */}
      {isSourceDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  소스 삭제
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <p>정말로 이 소스를 삭제하시겠습니까?</p>
              <p className="mt-1 text-xs opacity-80">
                임베딩 데이터도 함께 삭제됩니다.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIsSourceDeleteModalOpen(false);
                  setDeleteTargetDocId(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                취소
              </button>
              <button
                onClick={confirmDeleteDocument}
                disabled={isDeletingSource}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletingSource ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  '삭제'
                )}
              </button>
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
