import uuid
from datetime import datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class KnowledgeBase(Base):
    """
    지식 베이스 모델: 여러 문서를 그룹화하는 최상위 개념
    """

    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 임베딩 모델 정보
    embedding_model: Mapped[str] = mapped_column(
        String(50), default="text-embedding-3-small"
    )
    # 검색 설정
    top_k: Mapped[int] = mapped_column(Integer, default=5)
    similarity_threshold: Mapped[float] = mapped_column(Float, default=0.7)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
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
    문서 모델: 업로드된 개별 파일
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
    file_path: Mapped[str] = mapped_column(String, nullable=False)

    # 상태 관리: pending -> indexing -> completed / failed / waiting_for_approval
    status: Mapped[str] = mapped_column(String(50), default="pending")

    # 실패 원인 담는 에러메세지
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 청킹 설정
    chunk_size: Mapped[int] = mapped_column(Integer, default=1000)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=200)

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
    실제 검색 대상이 되는 텍스트 조각과 벡터 임베딩을 저장
    """

    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id"), nullable=False
    )
    # 바로 검색 가능하도록 성능 최적화를 위해 추가함
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_bases.id"), nullable=False
    )

    # 실제 검색될 텍스트 내용
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # 벡터 데이터
    embedding: Mapped[list] = mapped_column(Vector())

    # 문서 내 순서 (나중에 앞뒤 문맥 가져올 때 사용)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)

    # 토큰 수 (LLM Context Window 계산용)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    # 청크별 메타데이터 (페이지 번호, 좌표 등 상세 정보)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default={})

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
