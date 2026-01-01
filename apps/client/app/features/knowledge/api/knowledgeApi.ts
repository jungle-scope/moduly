import axios from 'axios';

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
export interface IngestionResponse {
  knowledge_base_id: string;
  document_id: string;
  status: string;
  message: string;
}

export interface KnowledgeCreateRequest {
  file: File;
  name?: string;
  description?: string;
  embeddingModel: string;
  topK: number;
  similarity: number;
  chunkSize: number;
  chunkOverlap: number;
  knowledgeBaseId?: string;
}

export interface KnowledgeBaseResponse {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  created_at: string;
  embedding_model: string;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  status:
    | 'pending'
    | 'indexing'
    | 'completed'
    | 'failed'
    | 'waiting_for_approval';
  created_at: string;
  error_message?: string;
  chunk_count: number;
  token_count: number;
  meta_info?: {
    cost_estimate?: {
      pages: number;
      credits: number;
      cost_usd: number;
    };
    strategy?: string;
  };
}

export interface KnowledgeBaseDetailResponse extends KnowledgeBaseResponse {
  documents: DocumentResponse[];
}

export const knowledgeApi = {
  // 지식 베이스 생성 및 파일 업로드
  uploadKnowledgeBase: async (
    data: KnowledgeCreateRequest,
  ): Promise<IngestionResponse> => {
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.name) formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('embeddingModel', data.embeddingModel);
    formData.append('topK', data.topK.toString());
    formData.append('similarity', data.similarity.toString());
    formData.append('chunkSize', data.chunkSize.toString());
    formData.append('chunkOverlap', data.chunkOverlap.toString());
    if (data.knowledgeBaseId)
      formData.append('knowledgeBaseId', data.knowledgeBaseId);

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

  // 지식 베이스 수정 (이름, 설명)
  updateKnowledgeBase: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<KnowledgeBaseResponse> => {
    const response = await api.patch(`/knowledge/${id}`, data);
    return response.data;
  },

  // 파싱 비용 승인
  confirmDocumentParsing: async (documentId: string): Promise<any> => {
    const response = await api.post(`/rag/document/${documentId}/confirm`);
    return response.data;
  },

  deleteDocument: async (documentId: string) => {
    const response = await api.delete(`/rag/document/${documentId}`);
    return response.data;
  },
};
