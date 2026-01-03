'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Settings,
  Split,
  RefreshCw,
  Save,
  Check,
  AlertTriangle,
  FileJson,
  Zap,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  knowledgeApi,
  DocumentSegment,
  AnalyzeResponse,
  DocumentPreviewRequest,
} from '@/app/features/knowledge/api/knowledgeApi';
import { DocumentResponse } from '@/app/features/knowledge/types/Knowledge';

export default function DocumentSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;
  const documentId = params.documentId as string;

  // 상태 관리
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>(''); // 문서 상태
  // const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // 설정 상태
  const [chunkSize, setChunkSize] = useState<number>(1000);
  const [chunkOverlap, setChunkOverlap] = useState<number>(200);
  const [segmentIdentifier, setSegmentIdentifier] = useState<string>('\\n\\n');
  const [removeUrlsEmails, setRemoveUrlsEmails] = useState<boolean>(false);
  const [removeWhitespace, setRemoveWhitespace] = useState<boolean>(true);

  const [parsingStrategy, setParsingStrategy] = useState<
    'general' | 'llamaparse'
  >('general');
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<'preview' | 'save' | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewSegments, setPreviewSegments] = useState<DocumentSegment[]>([]);

  // 실시간 진행 상태
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  // SSE 연결 (Indexing 상태일 때)
  useEffect(() => {
    if (status !== 'indexing' || !documentId) return;

    const url = knowledgeApi.getProgressUrl(documentId);
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          // 에러 발생
          eventSource.close();
          setStatus('failed');
          toast.error(data.error);
          return;
        }

        // 진행 상황 업데이트
        setProgress(data.progress);
        setProgressMessage(data.message);

        // 완료 처리
        if (data.status === 'completed' || data.progress >= 100) {
          eventSource.close();
          setStatus('completed');
          toast.success('문서 처리가 완료되었습니다!');
          // 완료 후 페이지 새로고침 대신 상태만 업데이트 해둘 수도 있음
        }
        // 실패 처리
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

  // 초기 데이터 로드 (문서 정보 가져오기)
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        // 단일 문서 상세 조회
        const targetDoc = await knowledgeApi.getDocument(kbId, documentId);

        if (targetDoc) {
          setDocument(targetDoc);
          setStatus(targetDoc.status); // 문서 상태 설정

          // 전역 상태 업데이트 (미리보기 패널 등에서 참조할 경우)
          setChunkSize(targetDoc.chunk_size || 1000);
          setChunkOverlap(targetDoc.chunk_overlap || 200);

          // 메타데이터에서 설정 복원
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

          // 승인 대기 상태 감지 시 처리 로직
          if (doc.status === 'waiting_for_approval') {
            clearInterval(intervalId); // 폴링 중단

            // 메타데이터에서 비용 정보 복원하여 모달 띄우기
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

          // 폴링 시에도 진행률과 메시지를 동기화
          if (doc.meta_info) {
            if (typeof doc.meta_info.processing_progress === 'number') {
              setProgress(doc.meta_info.processing_progress);
            }
            if (doc.meta_info.processing_current_step) {
              setProgressMessage(doc.meta_info.processing_current_step);
            }
          }
        } catch (e) {
          console.error('Polling failed', e);
        }
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [status, params.id, params.documentId]);

  // 완료 시 자동 이동 처리
  useEffect(() => {
    if (status === 'completed' && progress >= 100) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/knowledge/${kbId}`);
      }, 3000); // 3초 대기
      return () => clearTimeout(timer);
    }
  }, [status, progress, router, kbId]);

  // 분석 및 비용 승인 로직
  const handleAnalyzeAndProceed = async (action: 'preview' | 'save') => {
    setIsAnalyzing(true);
    try {
      const result = await knowledgeApi.analyzeDocument(documentId);
      setAnalyzeResult(result);

      // 캐시가 있으면 바로 진행
      if (result.is_cached) {
        if (action === 'preview') {
          await executePreview('llamaparse');
        } else if (action === 'save') {
          await executeSave('llamaparse');
        }
        return;
      }

      setPendingAction(action);
      setShowCostConfirm(true); // 모달 오픈
    } catch (error) {
      console.error(error);
      toast.error('문서 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmCost = async () => {
    setShowCostConfirm(false);

    // 이미 진행 중이던 문서가 승인 대기 상태였던 경우 -> confirm API 호출
    if (status === 'waiting_for_approval') {
      try {
        setStatus('indexing'); // 다시 처리 중으로 변경
        await knowledgeApi.confirmDocumentParsing(documentId, 'llamaparse');
        toast.success('처리를 재개합니다.');
      } catch (e) {
        console.error(e);
        toast.error('처리 재개 실패');
      }
      return;
    }

    if (!pendingAction) return;

    if (pendingAction === 'preview') {
      await executePreview('llamaparse');
    } else if (pendingAction === 'save') {
      await executeSave('llamaparse');
    }
    setPendingAction(null);
  };

  // 설정 저장 및 처리 핸들러
  const executeSave = async (strategy: 'general' | 'llamaparse') => {
    if (!document) return;

    try {
      const requestData: DocumentPreviewRequest = {
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        segment_identifier: segmentIdentifier,
        remove_urls_emails: removeUrlsEmails,
        remove_whitespace: removeWhitespace,
        strategy: strategy,
      };

      await knowledgeApi.processDocument(
        params.id as string,
        document.id,
        requestData,
      );

      setStatus('indexing'); // 처리가 시작되면 즉시 로딩 화면 노출
      setProgress(0);
      toast.success(
        strategy === 'general'
          ? '일반 파싱으로 처리를 시작합니다.'
          : 'LlamaParse로 처리를 시작합니다.',
      );
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  const handleSaveClick = () => {
    if (parsingStrategy === 'general') {
      executeSave('general');
    } else {
      handleAnalyzeAndProceed('save');
    }
  };

  // 미리보기 실행 핸들러
  const executePreview = async (strategy: 'general' | 'llamaparse') => {
    if (!kbId || !documentId) return;

    setIsPreviewLoading(true);
    try {
      const response = await knowledgeApi.previewDocumentChunking(
        kbId,
        documentId,
        {
          chunk_size: Number(chunkSize),
          chunk_overlap: Number(chunkOverlap),
          segment_identifier: segmentIdentifier,
          remove_urls_emails: removeUrlsEmails,
          remove_whitespace: removeWhitespace,
          strategy: strategy,
        },
      );

      setPreviewSegments(response.segments);
      toast.success('청킹 미리보기 완료');
    } catch (error) {
      console.error(error);
      toast.error('미리보기 생성 실패');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewClick = () => {
    if (parsingStrategy === 'general') {
      executePreview('general');
    } else {
      handleAnalyzeAndProceed('preview');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
              문서 처리 방식 및 청킹 설정을 조정합니다.
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
                {/* 화살표 */}
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
          <div className="p-6 space-y-8">
            {/* Parsing Strategy Selection */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
                <FileJson className="w-4 h-4" />
                <h3>파싱 방법</h3>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* General Parsing Option */}
                <label
                  className={`relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all ${
                    parsingStrategy === 'general'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value="general"
                    checked={parsingStrategy === 'general'}
                    onChange={() => setParsingStrategy('general')}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      일반 파싱
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      무료, 빠른 속도. 텍스트 위주의 문서에 적합합니다.
                    </span>
                    <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] rounded">
                      무료
                    </span>
                  </div>
                </label>

                {/* Precise Parsing Option */}
                <label
                  className={`relative flex items-start p-4 cursor-pointer rounded-lg border-2 transition-all ${
                    parsingStrategy === 'llamaparse'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value="llamaparse"
                    checked={parsingStrategy === 'llamaparse'}
                    onChange={() => setParsingStrategy('llamaparse')}
                    className="mt-1 w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      정밀 파싱
                    </span>
                    <Link
                      href="/settings/provider"
                      target="_blank"
                      className="text-[10px] text-gray-500 hover:text-blue-600 underline decoration-dotted transition-colors"
                    >
                      API Key 등록
                    </Link>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                      이미지, 표, 복잡한 레이아웃을 정확하게 인식합니다.
                    </span>
                    <div className="flex gap-2 mt-2 items-center">
                      <span className="inline-block px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 text-[10px] rounded flex items-center gap-1">
                        <Zap className="w-3 h-3" /> 유료
                      </span>
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 leading-relaxed">
                <p>
                  💡 <strong>Tip:</strong> 문서에 표나 이미지가 많다면{' '}
                  <span className="text-yellow-600 font-medium">정밀 파싱</span>
                  을 사용하세요. 단순 텍스트 문서는 일반 파싱으로도 충분합니다.
                </p>
              </div>
            </section>

            {/* Chunk Settings */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
                <Split className="w-4 h-4" />
                <h3>청킹 설정 (Chunking)</h3>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Chunk Size
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-500">
                  한 청크에 포함될 최대 글자 수입니다.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Chunk Overlap
                </label>
                <input
                  type="number"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-500">
                  청크 간 중첩되는 글자 구간입니다.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Segment Identifier
                </label>
                <input
                  type="text"
                  value={segmentIdentifier}
                  onChange={(e) => setSegmentIdentifier(e.target.value)}
                  placeholder="예: \n\n"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                />
                <p className="text-xs text-gray-500">
                  문단을 구분하는 문자입니다.
                </p>
              </div>
            </section>

            {/* Preprocessing Settings */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium pb-2 border-b border-gray-100 dark:border-gray-700">
                <Settings className="w-4 h-4" />
                <h3>전처리 규칙</h3>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={removeWhitespace}
                      onChange={(e) => setRemoveWhitespace(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    공백/줄바꿈 정리
                  </span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={removeUrlsEmails}
                      onChange={(e) => setRemoveUrlsEmails(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    URL 및 이메일 제거
                  </span>
                </label>
              </div>
            </section>

            <button
              onClick={handlePreviewClick}
              disabled={isPreviewLoading || isAnalyzing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
              Original Document
            </h3>
            <span className="text-xs text-gray-500">Read-only</span>
          </div>
          <div className="flex-1 w-full h-full p-4">
            {kbId && documentId ? (
              <iframe
                src={`http://localhost:8000/api/v1/knowledge/${kbId}/documents/${documentId}/content`}
                className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
                title="Original Document Preview"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <FileText className="w-12 h-12 opacity-20" />
                <p>문서를 불러오는 중입니다...</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Right Panel: Preview Results */}
        <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Chunk Preview
            </h3>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
              {previewSegments.length} Segments
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
            {isPreviewLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 animate-in fade-in">
                <Loader2 className="w-8 h-8 mb-2 animate-spin text-blue-500" />
                <p>문서를 분석하고 있습니다...</p>
              </div>
            ) : previewSegments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <RefreshCw className="w-12 h-12 opacity-20" />
                <p>설정을 변경하고 Preview 버튼을 눌러주세요.</p>
              </div>
            ) : (
              previewSegments.map((segment, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30 rounded-t-lg">
                    <span className="text-xs font-semibold text-gray-500">
                      Segment #{idx + 1}
                    </span>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <span>{segment.char_count} chars</span>
                      <span>•</span>
                      <span>{segment.token_count} tokens</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {segment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Processing & Success Modal */}
      {(status === 'indexing' ||
        (status === 'completed' && progress >= 100)) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
            {/* 장식용 배경 효과 */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

            <div className="text-center space-y-6">
              {/* 아이콘 및 애니메이션 */}
              <div className="relative w-24 h-24 mx-auto">
                {status === 'completed' ? (
                  // 성공 아이콘
                  <div className="w-full h-full bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 animate-in zoom-in duration-300">
                    <Check className="w-12 h-12" />
                  </div>
                ) : (
                  // 로딩 스피너
                  <>
                    <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-blue-600 text-lg">
                      {progress}%
                    </div>
                  </>
                )}
              </div>

              {/* 텍스트 메시지 */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {status === 'completed' ? '처리 완료!' : '문서 처리 중...'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 min-h-[1.5em]">
                  {status === 'completed'
                    ? '잠시 후 지식 베이스로 이동합니다...'
                    : progressMessage || '작업을 준비하고 있습니다.'}
                </p>
              </div>

              {/* 프로그래스 바 */}
              <div className="w-full bg-gray-100 rounded-full h-2 dark:bg-gray-900 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    status === 'completed' ? 'bg-green-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              {/* 성공 메시지 (하단) */}
              {status === 'completed' && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-500 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                    <Check className="w-3.5 h-3.5" />
                    성공적으로 저장되었습니다
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Confirmation Modal */}
      {showCostConfirm && analyzeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4 text-yellow-600 dark:text-yellow-400">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                비용 승인 확인
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              선택하신 <strong>정밀 파싱(LlamaParse)</strong> 기능을
              사용하시겠습니까?
              <br />이 작업은 외부 API를 사용하며 비용이 발생합니다.
            </p>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-6 border border-gray-100 dark:border-gray-700">
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex justify-between">
                  <span className="text-gray-500">파일명</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {analyzeResult.filename}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">페이지 수</span>
                  <span className="font-medium">
                    {analyzeResult.cost_estimate.pages} Pages
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">예상 크레딧</span>
                  <span className="font-medium">
                    {analyzeResult.cost_estimate.credits} Credits
                  </span>
                </li>
                <li className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-yellow-600">
                  <span>예상 비용</span>
                  <span>
                    ${analyzeResult.cost_estimate.cost_usd.toFixed(4)} USD
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCostConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmCost}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                승인 및 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
