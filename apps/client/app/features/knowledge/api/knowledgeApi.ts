import axios from 'axios';
import {
  IngestionResponse,
  KnowledgeCreateRequest,
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
  DocumentResponse,
} from '../types/Knowledge';

export interface DocumentPreviewRequest {
  chunk_size: number;
  chunk_overlap: number;
  segment_identifier: string;
  remove_urls_emails?: boolean;
  remove_whitespace?: boolean;
  strategy?: 'general' | 'llamaparse';
}

export interface DocumentSegment {
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

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Axios 인스턴스 생성 (withCredentials 설정)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ 쿠키 자동 전송
});

// 401 에러 인터셉터 (인증 만료 시 로그인 페이지로)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Authentication expired, redirecting to login...');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

export const knowledgeApi = {
  // 지식 베이스 생성 및 파일 업로드
  uploadKnowledgeBase: async (
    data: KnowledgeCreateRequest,
  ): Promise<IngestionResponse> => {
    const formData = new FormData();
    if (data.file) formData.append('file', data.file);
    if (data.sourceType) formData.append('sourceType', data.sourceType);
    if (data.apiUrl) formData.append('apiUrl', data.apiUrl);
    if (data.apiMethod) formData.append('apiMethod', data.apiMethod);
    if (data.apiHeaders) formData.append('apiHeaders', data.apiHeaders);
    if (data.apiBody) formData.append('apiBody', data.apiBody);
    if (data.name) formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('embeddingModel', data.embeddingModel);
    formData.append('topK', data.topK.toString());
    formData.append('similarity', data.similarity.toString());
    formData.append('chunkSize', data.chunkSize.toString());
    formData.append('chunkOverlap', data.chunkOverlap.toString());
    if (data.knowledgeBaseId)
      formData.append('knowledgeBaseId', data.knowledgeBaseId);
    // [DEBUG] FormData 내용 확인
    // for (const [key, value] of formData.entries()) {
    //   console.log(`[DEBUG] ${key}:`, value);
    // }
    // Content-Type은 axios가 자동으로 multipart/form-data로 설정함
    const response = await api.post('/rag/upload', formData);
    return response.data;
  },

  // 지식 베이스 목록 조회
  getKnowledgeBases: async (): Promise<KnowledgeBaseResponse[]> => {
    // console.log('[knowledgeApi] Fetching knowledge bases...');
    try {
      const response = await api.get('/knowledge');
      // console.log('[knowledgeApi] Response status:', response.status);
      // console.log('[knowledgeApi] Response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('[knowledgeApi] Error details:', error);
      throw error;
    }
  },

  // 지식 베이스 상세 조회
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

  // 지식 베이스 수정 (이름, 설명)
  updateKnowledgeBase: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<KnowledgeBaseResponse> => {
    const response = await api.patch(`/knowledge/${id}`, data);
    return response.data;
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
