import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Workflow(Base):
    __tablename__ = "workflows"

    # === 기본 식별 필드 ===
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    app_id: Mapped[str] = mapped_column(String, nullable=False)

    # === 워크플로우 메타데이터 ===
    # type 필드 제외됨
    version: Mapped[str] = mapped_column(String, default="draft")
    marked_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    marked_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # === 핵심 기능 필드 (5가지) ===
    # PostgreSQL JSONB 타입 사용 - 성능 향상 및 JSON 쿼리 가능
    graph: Mapped[dict] = mapped_column(JSONB, nullable=True)
    _features: Mapped[dict] = mapped_column(JSONB, nullable=True)
    _environment_variables: Mapped[dict] = mapped_column(JSONB, nullable=True)
    _conversation_variables: Mapped[dict] = mapped_column(JSONB, nullable=True)
    _rag_pipeline_variables: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # === 메타데이터 필드 ===
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
