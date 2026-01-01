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
