export interface IngestionResponse {
  knowledge_base_id: string;
  document_id: string;
  status: string;
  message: string;
}

export interface KnowledgeCreateRequest {
  sourceType?: 'FILE' | 'API' | 'DB';
  file?: File;
  apiUrl?: string;
  apiMethod?: string;
  apiHeaders?: string;
  apiBody?: string;
  connectionId?: string;

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
  chunk_size?: number;

  chunk_overlap?: number;
  source_type?: 'FILE' | 'API' | 'DB';
  meta_info?: {
    cost_estimate?: {
      pages: number;
      credits: number;
      cost_usd: number;
    };
    strategy?: string;
    segment_identifier?: string;
    remove_urls_emails?: boolean;
    remove_whitespace?: boolean;
    [key: string]: any; // Allow other properties
  };
}

export interface KnowledgeBaseDetailResponse extends KnowledgeBaseResponse {
  documents: DocumentResponse[];
}
