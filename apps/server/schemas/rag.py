from datetime import datetime
from typing import List, Optional
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
