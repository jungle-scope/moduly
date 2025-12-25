from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from db.base import Base
import uuid

class Workflow(Base):
    __tablename__ = "workflows"

    # === 기본 식별 필드 ===
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    app_id: Mapped[str] = mapped_column(String, nullable=False)

    # === 워크플로우 메타데이터 ===
    # type 필드 제외됨
    version: Mapped[str] = mapped_column(String, default="draft")
    marked_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    marked_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # === 핵심 기능 필드 (5가지) ===
    # JSON 데이터는 Text 타입으로 저장 (PostgreSQL의 경우 JSONB 사용 권장하지만 여기선 호환성 위해 Text 사용 가능, Dify는 JSON/JSONB 사용)
    # 여기서는 요청하신 대로 Mapped[str] (SQLAlchemy에서는 Text 또는 String 매핑) 형태로 정의합니다.
    graph: Mapped[str] = mapped_column(Text, nullable=True)
    _features: Mapped[str] = mapped_column(Text, nullable=True)
    _environment_variables: Mapped[str] = mapped_column(Text, nullable=True)
    _conversation_variables: Mapped[str] = mapped_column(Text, nullable=True)
    _rag_pipeline_variables: Mapped[str] = mapped_column(Text, nullable=True)

    # === 메타데이터 필드 ===
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
