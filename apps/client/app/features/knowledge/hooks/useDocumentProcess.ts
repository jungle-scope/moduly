import { useState } from 'react';
import { toast } from 'sonner';
import {
  knowledgeApi,
  DocumentPreviewRequest,
  DocumentSegment,
  AnalyzeResponse,
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
  };
  connectionId?: string; // 외부에서 주입받을 수 있는 connectionId
}

export function useDocumentProcess({
  kbId,
  documentId,
  document,
  setStatus,
  setProgress,
  settings,
  connectionId: connectionIdOverride,
}: UseDocumentProcessProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<'preview' | 'save' | null>(
    null,
  );
  const [previewSegments, setPreviewSegments] = useState<DocumentSegment[]>([]);

  // 1. 공통 Request Data 생성 함수
  const createRequestData = (
    strategy: 'general' | 'llamaparse',
  ): DocumentPreviewRequest => {
    // console.log('[Debug] Settings selectedDbItems:', settings.selectedDbItems);
    const selections = Object.entries(settings.selectedDbItems).map(
      ([table, cols]) => ({
        table_name: table,
        columns: cols,
      }),
    );
    // console.log('[Debug] Transformed selections:', selections);
    // console.log('[Debug] Document meta_info:', document?.meta_info);

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
        // [추가] connectionIdOverride가 있으면 db_config에 포함하여 서버로 전송
        ...(connectionIdOverride
          ? { connection_id: connectionIdOverride }
          : {}),
      },
    };
  };

  // 2. 저장 및 처리 (Save)
  const executeSave = async (strategy: 'general' | 'llamaparse') => {
    if (!document) return;
    try {
      const requestData = createRequestData(strategy);
      console.log('[Debug] Save Request Data:', requestData);
      await knowledgeApi.processDocument(kbId, document.id, requestData);

      setStatus('indexing');
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

  // 3. 미리보기 (Preview)
  const executePreview = async (strategy: 'general' | 'llamaparse') => {
    if (!kbId || !documentId) return;
    setIsPreviewLoading(true);
    try {
      const requestData = createRequestData(strategy);
      // console.log('[Debug] Preview Request Data:', requestData);

      const response = await knowledgeApi.previewDocumentChunking(
        kbId,
        documentId,
        requestData,
      );
      console.log('[Debug] Preview Response:', response);
      setPreviewSegments(response.segments);
      toast.success('청킹 미리보기 완료');
    } catch (error) {
      console.error(error);
      toast.error('미리보기 생성 실패');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // 4. 비용 승인 핸들러
  const handleAnalyzeAndProceed = async (action: 'preview' | 'save') => {
    setIsAnalyzing(true);
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
      setIsAnalyzing(false);
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

  // ===========================================
  // [리팩토링] 소스 타입별 분기 처리 함수
  // ===========================================
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
