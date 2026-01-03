from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


# --- Dev A ---
class IngestionResponse(BaseModel):
    knowledge_base_id: UUID
    document_id: UUID
    status: str
    message: str


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    document_count: Optional[int] = None
    created_at: datetime
    embedding_model: str


class KnowledgeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    status: str
    created_at: datetime
    error_message: Optional[str] = None
    chunk_count: int = 0
    token_count: int = 0  # 추후 구현
    chunk_size: int = 1000
    chunk_overlap: int = 200
    source_type: str = "FILE"
    meta_info: Optional[dict] = None


class KnowledgeBaseDetailResponse(KnowledgeBaseResponse):
    documents: List[DocumentResponse]


# --- Retrieval Schemas (Dev B) ---
class SearchQuery(BaseModel):
    query: str
    top_k: int = 5
    knowledge_base_id: Optional[UUID] = None  # 특정 KB 검색 시 사용


class ChunkPreview(BaseModel):
    content: str
    document_id: UUID
    filename: str
    page_number: Optional[int] = None
    similarity_score: float


class RAGResponse(BaseModel):
    answer: str
    references: List[ChunkPreview]  # Metadata for UI source linking


class DocumentPreviewRequest(BaseModel):
    chunk_size: int = 500
    chunk_overlap: int = 50
    segment_identifier: str = "\n\n"
    remove_urls_emails: bool = False
    remove_whitespace: bool = True
    strategy: str = "general"  # "general" or "llamaparse"
    source_type: str = "FILE"  # FILE or API


class DocumentProcessRequest(DocumentPreviewRequest):
    # PreviewRequest와 동일한 필드를 사용 (상속)
    pass


class DocumentSegment(BaseModel):
    content: str
    token_count: int
    char_count: int


class DocumentAnalyzeResponse(BaseModel):
    filename: str
    cost_estimate: dict  # { "pages": int, "credits": int, "cost_usd": float }
    recommended_strategy: str = "general"
    is_cached: bool = False


class DocumentPreviewResponse(BaseModel):
    segments: List[DocumentSegment]
    total_count: int
    preview_text_sample: str = ""


# --- API Proxy Schema ---
class ApiPreviewRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
