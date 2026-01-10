import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.db.base import Base


class DeploymentType(str, Enum):
    """배포 타입"""

    API = "api"  # REST API로 배포 (인증 필요)
    WEBAPP = "webapp"  # 웹 앱으로 배포 (공개)
    WIDGET = "widget"  # 웹 위젯 임베딩 배포 (공개)
    MCP = "mcp"  # Model Context Protocol
    WORKFLOW_NODE = "workflow_node"  # 워크플로우 노드로 배포 (다른 워크플로우에서 재사용)


class WorkflowDeployment(Base):
    """
    워크플로우의 배포 기록을 관리하는 모델입니다.
    특정 버전의 워크플로우를 어떤 형태(Type)로 배포했는지 저장합니다.
    """

    __tablename__ = "workflow_deployments"

    # 1. Native UUID 사용
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # 🔗 원본 앱 (1:N 관계)
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 🔢 버전 관리 (1, 2, 3...)
    version: Mapped[int] = mapped_column(Integer, nullable=False)

    # 🤖 배포 형태 (Default: API)
    type: Mapped[DeploymentType] = mapped_column(
        SQLEnum(DeploymentType),
        default=DeploymentType.API,
        nullable=False,
    )

    # 배포 시점의 workflow snapshot
    graph_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # 배포 설정. 예시: {"rate_limit": 100, "timeout": 30}
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default={})

    # 입출력 스키마 (graph_snapshot에서 자동 추출하여 저장)
    input_schema: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, comment="StartNode 입력 변수 스키마"
    )
    output_schema: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, comment="AnswerNode 출력 변수 스키마"
    )

    # 배포/버전 설명 (예: "v1.0 챗봇 출시")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Users ID is UUID in user.py (FK)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # 배포 활성화 여부
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
