import {
  IngestionResponse,
  KnowledgeCreateRequest,
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
  DocumentResponse,
  SourceType,
} from '../types/Knowledge';

export interface JoinConfig {
  enabled: boolean;
  base_table?: string;
  joins?: Array<{
    from_table: string;
    to_table: string;
    from_column: string;
    to_column: string;
  }>;
}

export interface DocumentPreviewRequest {
  chunk_size: number;
  chunk_overlap: number;
  segment_identifier: string;
  remove_urls_emails?: boolean;
  remove_whitespace?: boolean;
  source_type: SourceType;
  strategy?: 'general' | 'llamaparse';
  db_config?: {
    selections: {
      table_name: string;
      columns: string[];
      sensitive_columns?: string[];
      aliases?: Record<string, string>;
      template?: string;
    }[];
    connection_id?: string;
    join_config?: JoinConfig;
  } | null;
  // [추가] 필터링 파라미터
  selection_mode?: 'all' | 'range' | 'keyword';
  chunk_range?: string;
  keyword_filter?: string;
  enable_auto_chunking?: boolean;
}

export interface DocumentSegment {
  created_at: string;
  updated_at?: string;
  content: string;
  token_count: number;
  char_count: number;
}

export interface DocumentPreviewResponse {
  segments: DocumentSegment[];
  total_count: number;
  preview_text_sample: string;
}

export interface AnalyzeResponse {
  filename: string;
  cost_estimate: {
    pages: number;
    credits: number;
    cost_usd: number;
  };
  recommended_strategy: string;
  is_cached: boolean;
}

// 외부(page.tsx, ..)에서 이 API 모듈을 통해 타입을 직접 import 할 수 있도록 내보냅니다.
export type {
  IngestionResponse,
  KnowledgeCreateRequest,
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
};

import { apiClient } from '@/lib/apiClient';

const API_BASE_URL = '/api/v1';

// 공통 API 클라이언트 사용
const api = apiClient;

export const knowledgeApi = {
  // [NEW] S3 Presigned URL 요청
  getPresignedUploadUrl: async (
    filename: string,
    contentType: string,
  ): Promise<{
    upload_url: string;
    s3_key: string;
    method: string;
  }> => {
    const response = await api.post('/rag/upload/presigned-url', {
      filename,
      content_type: contentType,
    });
    return response.data;
  },

  // [NEW] S3 직접 업로드
  uploadToS3: async (
    presignedUrl: string,
    file: File,
    contentType: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> => {
    // fetch API 사용 (axios는 CORS preflight 이슈 가능성)
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(
        `S3 upload failed: ${response.status} ${response.statusText}`,
      );
    }
  },

  // 참고자료 생성 및 파일 업로드
  uploadKnowledgeBase: async (
    data: KnowledgeCreateRequest,
  ): Promise<IngestionResponse> => {
    const formData = new FormData();

    // [NEW] S3 직접 업로드 정보 (있으면 추가)
    if (data.s3FileUrl) formData.append('s3FileUrl', data.s3FileUrl);
    if (data.s3FileKey) formData.append('s3FileKey', data.s3FileKey);

    // [기존] 파일 직접 전송
    if (data.file) formData.append('file', data.file);

    if (data.sourceType) formData.append('sourceType', data.sourceType);
    if (data.apiUrl) formData.append('apiUrl', data.apiUrl);
    if (data.apiMethod) formData.append('apiMethod', data.apiMethod);
    if (data.apiHeaders) formData.append('apiHeaders', data.apiHeaders);
    if (data.apiBody) formData.append('apiBody', data.apiBody);
    if (data.connectionId) formData.append('connectionId', data.connectionId);
    if (data.name) formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('embeddingModel', data.embeddingModel);
    formData.append('topK', data.topK.toString());
    formData.append('similarity', data.similarity.toString());
    formData.append('chunkSize', data.chunkSize.toString());
    formData.append('chunkOverlap', data.chunkOverlap.toString());
    if (data.knowledgeBaseId)
      formData.append('knowledgeBaseId', data.knowledgeBaseId);
    try {
      const response = await api.post('/rag/upload', formData);
      return response.data;
    } catch (error: any) {
      console.group('[knowledgeApi] uploadKnowledgeBase failed');
      console.error('Error object:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      console.groupEnd();
      throw error;
    }
  },

  // 참고자료 목록 조회
  getKnowledgeBases: async (): Promise<KnowledgeBaseResponse[]> => {
    try {
      const response = await api.get('/knowledge');
      return response.data;
    } catch (error) {
      console.error('[knowledgeApi] Error details:', error);
      throw error;
    }
  },

  // 참고자료 상세 조회
  getKnowledgeBase: async (
    id: string,
  ): Promise<KnowledgeBaseDetailResponse> => {
    const response = await api.get(`/knowledge/${id}`);
    return response.data;
  },

  // 단일 문서 상세 조회
  getDocument: async (
    kbId: string,
    documentId: string,
  ): Promise<DocumentResponse> => {
    const response = await api.get(
      `/knowledge/${kbId}/documents/${documentId}`,
    );
    return response.data;
  },

  // 참고자료 수정, 재인덱싱
  updateKnowledgeBase: async (
    id: string,
    data: { name?: string; description?: string; embedding_model?: string },
  ): Promise<KnowledgeBaseResponse> => {
    const response = await api.patch(`/knowledge/${id}`, data);
    return response.data;
  },

  // 참고자료 그룹 삭제
  deleteKnowledgeBase: async (id: string): Promise<void> => {
    await api.delete(`/knowledge/${id}`);
  },

  // 문서 파싱 승인 (LlamaParse 비용 발생 등)
  confirmDocumentParsing: async (
    documentId: string,
    strategy: 'llamaparse' | 'general' = 'llamaparse',
  ): Promise<any> => {
    // 쿼리 파라미터로 strategy 전달
    const response = await api.post(
      `/rag/document/${documentId}/confirm?strategy=${strategy}`,
    );
    return response.data;
  },

  // 문서 분석 (비용 예측)
  analyzeDocument: async (documentId: string): Promise<AnalyzeResponse> => {
    const response = await api.post(`/rag/document/${documentId}/analyze`);
    return response.data;
  },

  deleteDocument: async (documentId: string) => {
    const response = await api.delete(`/rag/document/${documentId}`);
    return response.data;
  },

  // 문서 청킹 미리보기
  previewDocumentChunking: async (
    kbId: string,
    documentId: string,
    data: DocumentPreviewRequest,
  ): Promise<DocumentPreviewResponse> => {
    const response = await api.post(
      `/knowledge/${kbId}/documents/${documentId}/preview`,
      data,
    );
    return response.data;
  },

  // 문서 처리 시작 (설정 저장 및 백그라운드 작업 트리거)
  processDocument: async (
    kbId: string,
    documentId: string,
    data: DocumentPreviewRequest,
  ): Promise<{ status: string; message: string }> => {
    const response = await api.post(
      `/knowledge/${kbId}/documents/${documentId}/process`,
      data,
    );
    return response.data;
  },

  syncDocument: async (
    kbId: string,
    documentId: string,
  ): Promise<{ status: string; message: string }> => {
    const response = await api.post(
      `/knowledge/${kbId}/documents/${documentId}/sync`,
    );
    return response.data;
  },

  // SSE 연결을 위한 URL 반환
  getProgressUrl: (documentId: string): string => {
    return `${API_BASE_URL}/rag/document/${documentId}/progress`;
  },

  // API Proxy Preview
  proxyApiPreview: async (data: {
    url: string;
    method: string;
    headers?: any;
    body?: any;
  }): Promise<any> => {
    const response = await api.post('/rag/proxy/preview', data);
    return response.data;
  },
};
