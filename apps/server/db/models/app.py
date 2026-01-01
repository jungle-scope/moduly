import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class App(Base):
    """
    앱 모델

    사용자가 생성한 AI 앱을 나타내는 테이블입니다.
    각 앱은 이름, 설명, 아이콘 정보를 가지며,
    추후 워크플로우와 연결될 수 있습니다.
    """

    __tablename__ = "apps"

    # === 기본 식별 필드 ===
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)

    # === 앱 정보 필드 ===
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # === 워크플로우 연결 ===
    workflow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=True
    )

    # === 앱 설정 필드 ===
    # 웹 앱 사이트 활성화 여부
    is_site_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # API 접근 활성화 여부
    is_api_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # 분당 요청 제한 (Requests Per Minute)
    api_requests_per_minute: Mapped[int] = mapped_column(Integer, default=60)
    # 시간당 요청 제한 (Requests Per Hour)
    api_requests_per_hour: Mapped[int] = mapped_column(Integer, default=3600)
    # 공개 앱 여부
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    # 트레이싱(추적) 설정 (JSON 형식 등)
    tracing_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 최대 활성 요청 수
    max_active_requests: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # === 메타데이터 필드 ===
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # === 관계 (Relationships) ===
    # workflow = relationship("Workflow", back_populates="apps")
    # 주의: Workflow 모델에도 apps = relationship("App", back_populates="workflow") 추가 필요
