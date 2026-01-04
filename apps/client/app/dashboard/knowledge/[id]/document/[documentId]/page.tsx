'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Save,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { knowledgeApi } from '@/app/features/knowledge/api/knowledgeApi';
import { DocumentResponse } from '@/app/features/knowledge/types/Knowledge';
import { useDocumentProcess } from '@/app/features/knowledge/hooks/useDocumentProcess';
// Separated Components
import FileSourceViewer from '@/app/features/knowledge/components/ingestion-views/FileSourceViewer';
import ApiSourceViewer from '@/app/features/knowledge/components/ingestion-views/ApiSourceViewer';
import DbSourceViewer from '@/app/features/knowledge/components/ingestion-views/DbSourceViewer';
import CommonChunkSettings from '@/app/features/knowledge/components/document-settings/CommonChunkSettings';
import ParsingStrategySettings from '@/app/features/knowledge/components/document-settings/ParsingStrategySettings';
import ChunkPreviewList from '@/app/features/knowledge/components/preview/ChunkPreviewList';
import DBConnectionForm from '@/app/features/knowledge/components/create-knowledge-modal/DBConnectionForm';
import { DBConfig } from '@/app/features/knowledge/types/db';
import { connectorApi } from '@/app/features/knowledge/api/connectorApi';

export default function DocumentSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;
  const documentId = params.documentId as string;

  // 상태 관리
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>(''); // 문서 상태
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [selectedDbItems, setSelectedDbItems] = useState<
    Record<string, string[]>
  >({});

  // 설정 상태
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = useState<number>(200);
  const [segmentIdentifier, setSegmentIdentifier] = useState<string>('\\n\\n');
  const [removeUrlsEmails, setRemoveUrlsEmails] = useState<boolean>(false);
  const [removeWhitespace, setRemoveWhitespace] = useState<boolean>(true);
  const [parsingStrategy, setParsingStrategy] = useState<
    'general' | 'llamaparse'
  >('general');
  const [apiOriginalData, setApiOriginalData] = useState<any>(null); // API 원본 데이터 (SessionStorage)

  // 실시간 진행 상태
  const [progress, setProgress] = useState(0);

  // [추가] DB 연결 수정 관련 상태
  const [connectionId, setConnectionId] = useState<string>('');
  const [isEditingConnection, setIsEditingConnection] = useState(false);
  const [formKey, setFormKey] = useState(0); // 폼 강제 리셋용 키
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // SSE 연결 (Indexing 상태일 때)
  useEffect(() => {
    if (status !== 'indexing' || !documentId) return;
    const url = knowledgeApi.getProgressUrl(documentId);
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          eventSource.close();
          setStatus('failed');
          toast.error(data.error);
          return;
        }
        setProgress(data.progress);
        if (data.status === 'completed' || data.progress >= 100) {
          eventSource.close();
          setStatus('completed');
          toast.success('문서 처리가 완료되었습니다!');
        }
        if (data.status === 'failed') {
          eventSource.close();
          setStatus('failed');
          toast.error(data.message || '처리 중 오류가 발생했습니다.');
        }
      } catch (err) {
        console.error('SSE Parse Error:', err);
      }
    };
    eventSource.onerror = (err) => {
      if (eventSource.readyState === EventSource.CLOSED) return;
      console.error('SSE Error:', err);
      eventSource.close();
    };
    return () => {
      eventSource.close();
    };
  }, [status, documentId]);
  // 초기 데이터 로드
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const targetDoc = await knowledgeApi.getDocument(kbId, documentId);
        if (targetDoc) {
          setDocument(targetDoc);
          setStatus(targetDoc.status);
          setChunkSize(targetDoc.chunk_size || 1000);
          setChunkOverlap(targetDoc.chunk_overlap || 200);
          if (targetDoc.meta_info) {
            if (targetDoc.meta_info.segment_identifier) {
              setSegmentIdentifier(targetDoc.meta_info.segment_identifier);
            }
            if (targetDoc.meta_info.remove_urls_emails !== undefined) {
              setRemoveUrlsEmails(targetDoc.meta_info.remove_urls_emails);
            }
            if (targetDoc.meta_info.remove_whitespace !== undefined) {
              setRemoveWhitespace(targetDoc.meta_info.remove_whitespace);
            }
            // DB 선택값 복원
            if (targetDoc.meta_info.db_config) {
              if (targetDoc.meta_info.db_config.selected_items) {
                setSelectedDbItems(
                  targetDoc.meta_info.db_config.selected_items,
                );
              }
              if (targetDoc.meta_info.db_config.connection_id) {
                setConnectionId(targetDoc.meta_info.db_config.connection_id);
              }
            }
            // Fallback for flat structure
            if (targetDoc.meta_info.connection_id) {
              setConnectionId(targetDoc.meta_info.connection_id);
            }
          }
        } else {
          toast.error('문서를 찾을 수 없습니다.');
          router.push(`/dashboard/knowledge/${kbId}`);
        }
      } catch (error) {
        console.error(error);
        toast.error('문서 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    if (kbId && documentId) {
      fetchDocument();
    }
  }, [kbId, documentId, router]);
  // SessionStorage에서 API 원본 데이터 불러오기
  useEffect(() => {
    if (
      document?.source_type === 'API' &&
      document.meta_info?.api_config?.url
    ) {
      const storageKey = 'api_preview' + document.meta_info.api_config.url;
      const storedData = sessionStorage.getItem(storageKey);
      if (storedData) {
        try {
          setApiOriginalData(JSON.parse(storedData));
        } catch (e) {
          console.error(
            'Failed to parse API preview data from sessionStorage',
            e,
          );
        }
      }
    }
  }, [document]);
  // useDocumentProcess Hook 사용
  const {
    isAnalyzing,
    isPreviewLoading,
    showCostConfirm,
    setShowCostConfirm,
    analyzeResult,
    setAnalyzeResult,
    setPendingAction,
    previewSegments,
    handleSaveClick,
    handlePreviewClick,
    handleConfirmCost,
  } = useDocumentProcess({
    kbId,
    documentId,
    document,
    setStatus,
    setProgress,
    settings: {
      chunkSize,
      chunkOverlap,
      segmentIdentifier,
      removeUrlsEmails,
      removeWhitespace,
      parsingStrategy,
      selectedDbItems,
    },
    connectionId: connectionId,
  });

  // DB 연결 저장 핸들러
  const handleConnectionRequest = async (config: DBConfig) => {
    try {
      const newConn = await connectorApi.createConnector(config);
      if (newConn.success && newConn.id) {
        setConnectionId(newConn.id); // ID 업데이트 -> 스키마 새로고침 트리거됨
        toast.success('DB 연결 정보가 업데이트되었습니다.');
        setIsEditingConnection(false); // 폼 닫기
        return true;
      } else {
        toast.error(newConn.message || '연결 실패');
        return false;
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.detail || '오류 발생');
      return false;
    }
  };

  const handleEditConnection = async () => {
    if (!connectionId) {
      toast.error('연결 ID가 없습니다.');
      return;
    }

    setIsLoadingDetails(true);
    try {
      const details = await connectorApi.getConnectionDetails(connectionId);
      setConnectionDetails(details);
      setIsEditingConnection(true);
      setFormKey((prev) => prev + 1);
    } catch (e: any) {
      console.error(e);
      toast.error('연결 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // 상태 폴링
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (
      status === 'pending' ||
      status === 'indexing' ||
      status === 'waiting_for_approval'
    ) {
      intervalId = setInterval(async () => {
        try {
          const doc = await knowledgeApi.getDocument(
            params.id as string,
            params.documentId as string,
          );
          setStatus(doc.status);

          if (doc.status === 'waiting_for_approval') {
            clearInterval(intervalId);
            if (doc.meta_info && doc.meta_info.cost_estimate) {
              setAnalyzeResult({
                cost_estimate: doc.meta_info.cost_estimate,
                filename: doc.filename,
                is_cached: false,
                recommended_strategy: 'llamaparse',
              });
              setPendingAction('save');
              setShowCostConfirm(true);
              toast.warning('정밀 파싱을 위해 추가 승인이 필요합니다.');
            }
            return;
          }

          if (doc.status === 'completed' || doc.status === 'failed') {
            clearInterval(intervalId);
          }

          if (doc.meta_info) {
            if (typeof doc.meta_info.processing_progress === 'number') {
              setProgress(doc.meta_info.processing_progress);
            }
          }
        } catch (e) {
          console.error('Polling failed', e);
        }
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [
    status,
    params.id,
    params.documentId,
    setAnalyzeResult,
    setPendingAction,
    setShowCostConfirm,
  ]);

  // 완료 시 자동 이동
  useEffect(() => {
    if (status === 'completed' && progress >= 100) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/knowledge/${kbId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, progress, router, kbId]);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  // 중앙 패널 렌더러
  const renderCenterPanel = () => {
    if (!document) return null;
    switch (document.source_type) {
      case 'DB':
        return (
          <div className="flex flex-col h-full">
            {/* DB 연결 수정 섹션 */}
            <div className="mb-4">
              {!isEditingConnection ? (
                <button
                  onClick={handleEditConnection} // [변경] 직접 토글 대신 핸들러 호출
                  disabled={isLoadingDetails}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 shadow-sm disabled:opacity-50"
                >
                  {isLoadingDetails ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                      로딩 중...
                    </>
                  ) : (
                    '⚙️ DB 연결 설정 수정'
                  )}
                </button>
              ) : (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      DB 연결 정보 수정
                    </h4>
                    <button
                      onClick={() => {
                        setIsEditingConnection(false);
                        setConnectionDetails(null); // 상세 정보 초기화
                      }}
                      className="text-gray-500 hover:text-gray-700 text-xs"
                    >
                      취소
                    </button>
                  </div>
                  <DBConnectionForm
                    key={formKey} // 폼 초기화
                    onChange={() => {}}
                    onTestConnection={handleConnectionRequest}
                    initialConfig={connectionDetails}
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <DbSourceViewer
                connectionId={connectionId} // 업데이트된 ID 사용
                selectedDbItems={selectedDbItems}
                onChange={setSelectedDbItems}
              />
            </div>
          </div>
        );
      case 'API':
        return (
          <ApiSourceViewer
            apiOriginalData={apiOriginalData}
            apiConfig={document.meta_info?.api_config}
          />
        );
      default: // FILE
        return <FileSourceViewer kbId={kbId} documentId={documentId} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-none px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              {document?.filename || '문서 설정'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              소스 처리 방식 및 청킹 설정을 조정합니다.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              onClick={handleSaveClick}
              disabled={isAnalyzing || status === 'completed'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장 및 처리 시작
            </button>
            {status === 'completed' && (
              <div className="absolute top-full right-0 mt-2 w-max max-w-[250px] p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 text-center break-keep">
                재인덱싱이 필요하여 파일을 삭제하고 다시 추가해야 합니다.
                <div className="absolute -top-1 right-6 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Main Layout (3 Columns) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Left Panel: Settings */}
        <div className="w-80 flex-none bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6">
            {/* FILE일 때만 파싱 전략 노출 */}
            {(document?.source_type === 'FILE' || !document?.source_type) && (
              <ParsingStrategySettings
                strategy={parsingStrategy}
                setStrategy={setParsingStrategy}
              />
            )}
            <CommonChunkSettings
              chunkSize={chunkSize}
              setChunkSize={setChunkSize}
              chunkOverlap={chunkOverlap}
              setChunkOverlap={setChunkOverlap}
              segmentIdentifier={segmentIdentifier}
              setSegmentIdentifier={setSegmentIdentifier}
              removeWhitespace={removeWhitespace}
              setRemoveWhitespace={setRemoveWhitespace}
              removeUrlsEmails={removeUrlsEmails}
              setRemoveUrlsEmails={setRemoveUrlsEmails}
            />
            <button
              onClick={handlePreviewClick}
              disabled={isPreviewLoading || isAnalyzing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreviewLoading || isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Preview Chunking
            </button>
          </div>
        </div>
        {/* 2. Center Panel: Original Document View */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900/50 overflow-hidden flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {document?.source_type === 'API'
                ? 'Extracted Text Preview'
                : document?.source_type === 'DB'
                  ? 'Select Tables & Columns'
                  : 'Original Document'}
            </h3>
            {document?.source_type !== 'DB' && (
              <span className="text-xs text-gray-500">Read-only</span>
            )}
          </div>
          <div className="flex-1 w-full h-full p-4">{renderCenterPanel()}</div>
        </div>
        {/* 3. Right Panel: Preview Results */}
        <ChunkPreviewList
          previewSegments={previewSegments}
          isLoading={isPreviewLoading}
        />
      </div>
      {/* 비용 승인 모달 */}
      {showCostConfirm && analyzeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold">비용 승인 필요</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              선택하신{' '}
              <span className="font-bold text-gray-900 dark:text-white">
                정밀 파싱(LlamaParse)
              </span>
              은 유료 기능입니다.
              <br />
              <span className="block mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm">
                파일: <strong>{analyzeResult.filename}</strong>
                <br />
                예상 결제 포인트:{' '}
                <strong className="text-amber-600">
                  {analyzeResult.cost_estimate.credits} P
                </strong>
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCostConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmCost}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                승인 및 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
