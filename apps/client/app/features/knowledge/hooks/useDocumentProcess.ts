import { useState } from 'react';
import { toast } from 'sonner';
import {
  knowledgeApi,
  DocumentPreviewRequest,
  DocumentSegment,
  AnalyzeResponse,
  JoinConfig,
} from '@/app/features/knowledge/api/knowledgeApi';
import { DocumentResponse } from '@/app/features/knowledge/types/Knowledge';

interface UseDocumentProcessProps {
  kbId: string;
  documentId: string;
  document: DocumentResponse | null;
  setStatus: (status: string) => void;
  setProgress: (progress: number) => void;
  settings: {
    chunkSize: number;
    chunkOverlap: number;
    segmentIdentifier: string;
    removeUrlsEmails: boolean;
    removeWhitespace: boolean;
    parsingStrategy: 'general' | 'llamaparse';
    selectedDbItems: Record<string, string[]>;
    sensitiveColumns?: Record<string, string[]>;
    aliases?: Record<string, Record<string, string>>;
    template?: string;
    enableAutoChunking?: boolean;
    joinConfig?: JoinConfig | null;
  };
  connectionId?: string; // 외부에서 주입받을 수 있는 connectionId
  // 범위 선택 관련
  selectionMode?: 'all' | 'range' | 'keyword';
  chunkRange?: string; // "1-100, 500-600"
  keywordFilter?: string;
}

export function useDocumentProcess({
  kbId,
  documentId,
  document,
  setStatus,
  setProgress,
  settings,
  connectionId: connectionIdOverride,
  selectionMode = 'all',
  chunkRange = '',
  keywordFilter = '',
}: UseDocumentProcessProps) {
  const [analyzingAction, setAnalyzingAction] = useState<
    'preview' | 'save' | null
  >(null);
  const isAnalyzing = analyzingAction !== null;
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<'preview' | 'save' | null>(
    null,
  );
  const [previewSegments, setPreviewSegments] = useState<DocumentSegment[]>([]);

  // 공통 Request Data 생성 함수
  const createRequestData = (
    strategy: 'general' | 'llamaparse',
  ): DocumentPreviewRequest => {
    const selections = Object.entries(settings.selectedDbItems).map(
      ([table, cols]) => {
        const sensitiveColumnsForTable =
          settings.sensitiveColumns?.[table] || [];
        return {
          table_name: table,
          columns: cols,
          sensitive_columns: sensitiveColumnsForTable,
        };
      },
    );

    return {
      chunk_size: settings.chunkSize,
      chunk_overlap: settings.chunkOverlap,
      segment_identifier: settings.segmentIdentifier,
      remove_urls_emails: settings.removeUrlsEmails,
      remove_whitespace: settings.removeWhitespace,
      strategy: strategy,
      source_type: document?.source_type || 'FILE',
      db_config: {
        selections,
        selected_items: settings.selectedDbItems,
        sensitive_columns: settings.sensitiveColumns,
        aliases: settings.aliases,
        template: settings.template,
        join_config: settings.joinConfig || undefined,
        ...(connectionIdOverride
          ? { connection_id: connectionIdOverride }
          : {}),
      },
      // 자동 청킹 설정
      enable_auto_chunking: settings.enableAutoChunking ?? true,
      // 필터링 파라미터 전송
      selection_mode: selectionMode,
      chunk_range: chunkRange,
      keyword_filter: keywordFilter,
    };
  };

  // 저장 및 처리 (Save)
  const executeSave = async (strategy: 'general' | 'llamaparse') => {
    if (!document) return;
    try {
      const requestData = createRequestData(strategy);
      await knowledgeApi.processDocument(kbId, document.id, requestData);

      setStatus('indexing');
      setProgress(0);

      const isFile = document.source_type === 'FILE' || !document.source_type;

      if (isFile) {
        toast.success(
          strategy === 'general'
            ? '일반 파싱으로 처리를 시작합니다.'
            : 'LlamaParse로 처리를 시작합니다.',
        );
      } else {
        toast.success('데이터 처리를 시작합니다.');
      }
    } catch (error: any) {
      console.error('[Debug] Save failed:', error);
      console.error('[Debug] Error details:', error.response?.data);
      toast.error('저장에 실패했습니다.');
    }
  };

  // 3. 미리보기 (Preview)
  const executePreview = async (strategy: 'general' | 'llamaparse') => {
    if (!kbId || !documentId) return;
    setIsPreviewLoading(true);
    try {
      const requestData = createRequestData(strategy);

      const response = await knowledgeApi.previewDocumentChunking(
        kbId,
        documentId,
        requestData,
      );

      // 서버에서 필터링된 결과를 그대로 사용 (클라이언트 필터링 로직 제거)
      setPreviewSegments(response.segments);
      toast.success(`청킹 미리보기 완료 (${response.segments.length}개 청크)`);
    } catch (error) {
      console.error(error);
      toast.error('미리보기 생성 실패');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // 비용 승인 핸들러
  const handleAnalyzeAndProceed = async (action: 'preview' | 'save') => {
    setAnalyzingAction(action);
    try {
      const result = await knowledgeApi.analyzeDocument(documentId);
      setAnalyzeResult(result);

      if (result.is_cached) {
        if (action === 'preview') await executePreview('llamaparse');
        else await executeSave('llamaparse');
        return;
      }
      setPendingAction(action);
      setShowCostConfirm(true);
    } catch (error) {
      console.error(error);
      toast.error('문서 분석에 실패했습니다.');
    } finally {
      setAnalyzingAction(null);
    }
  };

  // 5. 비용 승인 확인
  const handleConfirmCost = async () => {
    setShowCostConfirm(false);

    // waiting_for_approval 상태에서 재개하는 경우
    if (document?.status === 'waiting_for_approval') {
      try {
        setStatus('indexing');
        await knowledgeApi.confirmDocumentParsing(documentId, 'llamaparse');
        toast.success('처리를 재개합니다.');
      } catch (e) {
        console.error(e);
        toast.error('처리 재개 실패');
      }
      return;
    }

    if (!pendingAction) return;

    if (pendingAction === 'preview') await executePreview('llamaparse');
    else if (pendingAction === 'save') await executeSave('llamaparse');
    setPendingAction(null);
  };

  const handleSaveClick = () => {
    if (
      document?.source_type === 'API' ||
      document?.source_type === 'DB' ||
      settings.parsingStrategy === 'general'
    ) {
      executeSave('general');
    } else {
      handleAnalyzeAndProceed('save');
    }
  };

  const handlePreviewClick = () => {
    if (
      document?.source_type === 'API' ||
      document?.source_type === 'DB' ||
      settings.parsingStrategy === 'general'
    ) {
      executePreview('general');
    } else {
      handleAnalyzeAndProceed('preview');
    }
  };

  return {
    isAnalyzing,
    analyzingAction,
    isPreviewLoading,
    showCostConfirm,
    setShowCostConfirm,
    analyzeResult,
    setAnalyzeResult, // page.tsx에서 polling 결과 업데이트용
    setPendingAction, // page.tsx에서 polling 결과 업데이트용
    previewSegments,
    setPreviewSegments,
    handleSaveClick,
    handlePreviewClick,
    handleConfirmCost,
  };
}
