import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Workflow(Base):
    __tablename__ = "workflows"

    # === 기본 식별 필드 ===
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("apps.id"), nullable=False
    )

    # === 핵심 기능 필드 ===
    graph: Mapped[dict] = mapped_column(JSONB, nullable=True)
    features: Mapped[dict] = mapped_column(JSONB, nullable=True)
    env_variables: Mapped[dict] = mapped_column(JSONB, nullable=True)
    runtime_variables: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # === 메타데이터 필드 ===
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
