"""Schedule Model - 배포된 워크플로우의 스케줄 정보"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.shared.db.base import Base


class Schedule(Base):
    """
    배포된 워크플로우의 스케줄 정보를 저장합니다.

    관계:
    - 1 Deployment : 1 Schedule (ScheduleTrigger 노드가 있는 경우)
    - deployment_id는 UNIQUE 제약 조건

    동작 방식:
    - 서버 시작 시: DB에서 모든 활성 스케줄 로드 -> APScheduler 메모리 등록
    - 배포 생성 시: Schedule 레코드 생성 -> APScheduler에 즉시 등록
    - 배포 삭제 시: ON DELETE CASCADE로 자동 삭제
    """

    __tablename__ = "schedules"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        index=True,
    )

    # Foreign Key: Deployment (1:1 관계)
    deployment_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_deployments.id", ondelete="CASCADE"),
        unique=True,  # 한 배포는 하나의 스케줄만
        nullable=False,
        index=True,
    )

    # ScheduleTriggerNode의 ID (배포 스냅샷 내에서)
    node_id: Mapped[str] = mapped_column(
        String, nullable=False, comment="ScheduleTrigger 노드 ID"
    )

    # Cron 표현식
    cron_expression: Mapped[str] = mapped_column(
        String,
        nullable=False,
        comment="Cron 표현식 (예: '0 9 * * *' = 매일 오전 9시)",
    )

    # 타임존
    timezone: Mapped[str] = mapped_column(
        String, nullable=False, default="UTC", comment="타임존 (예: Asia/Seoul, UTC)"
    )

    # 실행 이력
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="마지막 실행 시간"
    )

    next_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="다음 실행 예정 시간 (APScheduler가 계산)",
    )

    # 메타데이터
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
