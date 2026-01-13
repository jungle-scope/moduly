import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class App(Base):
    """
    앱 모델

    사용자가 생성한 AI 앱을 나타내는 테이블입니다.
    각 앱은 이름, 설명, 아이콘 정보를 가집니다.
    """

    __tablename__ = "apps"

    # === 기본 식별 필드 ===
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        default=uuid.uuid4,
        nullable=False,
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # === 앱 정보 필드 ===
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # === 워크플로우 연결 ===
    workflow_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=True
    )

    # === 활성 배포 ===
    active_deployment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # === 활성 배포 객체 (Active Deployment Object) ===
    active_deployment = relationship(
        "WorkflowDeployment",
        primaryjoin="foreign(App.active_deployment_id) == remote(WorkflowDeployment.id)",
        viewonly=True,
    )

    @property
    def active_deployment_type(self):
        # 활성 배포 타입 (Active Deployment Type)
        return self.active_deployment.type if self.active_deployment else None

    # === 엔드포인트 설정 (앱 생성 시 생성) ===
    url_slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    auth_secret: Mapped[str] = mapped_column(String, nullable=False)

    # === 앱 설정 필드 ===
    is_api_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    api_req_per_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    api_req_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)

    # === 마켓플레이스 ===
    is_market: Mapped[bool] = mapped_column(
        Boolean, nullable=False, index=True, default=False
    )
    # 원본 앱 (마켓에서 복제한 경우)
    forked_from: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="Original app ID if cloned from marketplace",
    )

    # === 메타데이터 필드 ===
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # === 관계 (Relationships) ===
    # workflow = relationship("Workflow", back_populates="apps")
    # 주의: Workflow 모델에도 apps = relationship("App", back_populates="workflow") 추가 필요
