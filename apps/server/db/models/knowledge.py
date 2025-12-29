import uuid
from datetime import datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class KnowledgeBase(Base):
    """
    지식 베이스 모델
    여러 문서를 그룹화하는 최상위 개념입니다.
    """

    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 임베딩 모델 정보 (확장성 고려: 나중에 모델을 변경할 수 있도록 저장)
    embedding_model: Mapped[str] = mapped_column(
        String(50), default="text-embedding-3-small"
    )

    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationship
    documents: Mapped[List["Document"]] = relationship(
        "Document", back_populates="knowledge_base", cascade="all, delete-orphan"
    )


class Document(Base):
    """
    문서 모델
    업로드된 개별 파일을 나타냅니다.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # 어떤 지식 베이스에 속했는지 연결
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_bases.id"), nullable=False
    )

    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)  # 로컬이나 S3 경로

    # 상태 관리: pending -> indexing -> completed / failed
    status: Mapped[str] = mapped_column(String(20), default="pending")

    # 메타 데이터 (파일 크기, 파싱 결과 요약 등)
    meta_info: Mapped[dict] = mapped_column(JSONB, default={})

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    knowledge_base: Mapped["KnowledgeBase"] = relationship(
        "KnowledgeBase", back_populates="documents"
    )
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    """
    문서 청크 모델 (Vector Store)
    실제 검색 대상이 되는 텍스트 조각과 벡터 임베딩을 저장합니다.
    """

    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id"), nullable=False
    )

    # 실제 검색될 텍스트 내용
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # 벡터 데이터 (OpenAI text-embedding-3-small 기준 1536차원)
    embedding: Mapped[list] = mapped_column(Vector(1536))

    # 문서 내 순서 (나중에 앞뒤 문맥 가져올 때 사용)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)

    # 토큰 수 (LLM Context Window 계산용)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    # 청크별 메타데이터 (페이지 번호, 좌표 등 상세 정보)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default={})

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
