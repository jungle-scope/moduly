from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


# --- Ingestion Schemas (Dev A) ---
class IngestionResponse(BaseModel):
    knowledge_base_id: UUID
    document_id: UUID
    status: str
    message: str


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    document_count: int
    created_at: datetime
    embedding_model: str


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
