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
  Trash2,
  RefreshCw,
  Bot,
  Globe,
} from 'lucide-react';
import {
  knowledgeApi,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
import CreateKnowledgeModal from '@/app/features/knowledge/components/create-knowledge-modal';
import KnowledgeSearchModal from '@/app/features/knowledge/components/knowledge-search-modal';
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

  // 데이터 조회
  const fetchKnowledgeBase = async () => {
    try {
      setIsLoading(true);
      const data = await knowledgeApi.getKnowledgeBase(id);
      setKnowledgeBase(data);

      setEditName(data.name);
      setEditDesc(data.description || '');
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

  // 문서 상태 자동 갱신 (Polling)
  useEffect(() => {
    // 처리 중(indexing, processing, pending)인 문서가 존재하는지 확인
    const hasProcessingDocs = knowledgeBase?.documents.some((doc) =>
      ['indexing', 'processing', 'pending'].includes(doc.status),
    );

    // 처리 중인 문서가 있다면 3초마다 상태 갱신
    if (hasProcessingDocs) {
      const intervalId = setInterval(() => {
        fetchKnowledgeBase();
      }, 3000);
      return () => clearInterval(intervalId);
    }
  }, [knowledgeBase, id]);

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
      toast.success('문서가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('문서 삭제에 실패했습니다.');
    }
  };

  const handleSyncDocument = async (documentId: string) => {
    try {
      await knowledgeApi.syncDocument(id, documentId);
      fetchKnowledgeBase();
      toast.success('API 동기화가 시작되었습니다.');
    } catch (error) {
      console.error('Failed to sync document:', error);
      toast.error('API 동기화 실패');
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

  // 지식 베이스 삭제 핸들러
  const handleDeleteKnowledgeBase = async () => {
    if (deleteConfirmName !== knowledgeBase?.name) {
      toast.error('지식 베이스 이름이 일치하지 않습니다.');
      return;
    }
    try {
      setIsDeleting(true);
      await knowledgeApi.deleteKnowledgeBase(id);
      toast.success('지식 베이스가 삭제되었습니다.');
      router.push('/dashboard/knowledge');
    } catch (error) {
      console.error('Failed to delete kb:', error);
      toast.error('지식 베이스 삭제 실패');
      setIsDeleting(false);
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
        <div className="flex-1 mr-4">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600 flex-shrink-0" />
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameUpdate}
                onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
                autoFocus
                className="text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="text-3xl font-bold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 -ml-2 transition-colors"
                title="클릭하여 이름 수정"
              >
                {knowledgeBase.name}
              </h1>
            )}
          </div>
          <div className="mt-2 ml-11">
            {isEditingDesc ? (
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onBlur={handleDescUpdate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleDescUpdate();
                  }
                }}
                autoFocus
                rows={2}
                className="text-gray-600 dark:text-gray-400 bg-transparent border-b-2 border-blue-500 focus:outline-none w-full resize-none"
              />
            ) : (
              <p
                onClick={() => setIsEditingDesc(true)}
                className="text-gray-600 dark:text-gray-400 max-w-3xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 -ml-2 transition-colors min-h-6"
                title="클릭하여 설명 수정"
              >
                {knowledgeBase.description || '설명 없음 (클릭하여 추가)'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 mt-4 ml-11 text-sm text-gray-500 dark:text-gray-400">
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
        <div className="flex items-center">
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg transition-colors mr-3 shadow-sm"
          >
            <Bot className="w-5 h-5 mr-1.5 text-blue-600 dark:text-blue-400" />
            검색 테스트
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            추가
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            데이터 소스 목록
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
                <th className="px-6 py-4">업로드 일시</th>
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
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 opacity-20" />
                      <p>아직 등록된 문서가 없습니다.</p>
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
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-xs font-semibold">
                          <Database className="w-3.5 h-3.5" />
                          DB
                        </div>
                      ) : doc.source_type === 'API' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-semibold">
                          <Globe className="w-3.5 h-3.5" />
                          API
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold">
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
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {doc.source_type === 'API' && (
                        <button
                          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors mr-2"
                          onClick={() => handleSyncDocument(doc.id)}
                          title="API 데이터 동기화"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                        onClick={() => handleDeleteDocument(doc.id)}
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

      {/* Danger Zone */}
      <div className="mt-12 border border-red-200 dark:border-red-900/50 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-200 dark:border-red-900/50">
          <h3 className="text-red-800 dark:text-red-400 font-semibold flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </h3>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 flex items-center justify-between">
          <div>
            <h4 className="text-gray-900 dark:text-gray-100 font-medium mb-1">
              지식 베이스 삭제
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              이 지식 베이스와 관련된 모든 문서 및 임베딩 데이터가 영구적으로
              삭제됩니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
          >
            지식 베이스 삭제
          </button>
        </div>
      </div>

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
                <p className="font-semibold mb-1">경고: 복구할 수 없습니다.</p>
                <p>
                  삭제하시려면 지식 베이스 이름{' '}
                  <span className="font-bold underline">
                    {knowledgeBase.name}
                  </span>
                  을 똑같이 입력해주세요.
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
    </div>
  );
}
