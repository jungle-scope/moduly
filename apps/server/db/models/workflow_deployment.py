import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class DeploymentType(str, Enum):
    """배포 유형 (확장 가능)"""

    API = "api"  # REST API
    WIDGET = "widget"  # 웹 위젯
    SLACK = "slack"  # 슬랙 봇
    DISCORD = "discord"  # 디스코드 봇
    MCP = "mcp"  # Model Context Protocol
    LIBRARY = "library"  # Python/JS 라이브러리


class WorkflowDeployment(Base):
    """
    워크플로우의 배포 기록을 관리하는 모델입니다.
    특정 버전의 워크플로우를 어떤 형태(Type)로 배포했는지 저장합니다.
    """

    __tablename__ = "workflow_deployments"
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # 🔗 원본 워크플로우 (1:N 관계)
    workflow_id: Mapped[str] = mapped_column(
        String, ForeignKey("workflows.id"), nullable=False, index=True
    )
    # 🔢 버전 관리 (1, 2, 3...)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    # 🤖 배포 형태 (Default: API)
    type: Mapped[DeploymentType] = mapped_column(
        SQLEnum(DeploymentType), default=DeploymentType.API, nullable=False
    )
    # 🔑 실행 및 인증 정보
    # API: 엔드포인트 URL (예: /api/v1/run/{uuid})
    endpoint_url: Mapped[Optional[str]] = mapped_column(
        String, unique=True, nullable=True
    )

    # API Key 또는 봇 토큰 (보안을 위해 해시 저장 권장)
    auth_secret: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # 📦 [핵심] 불변 스냅샷 데이터
    # 배포 시점의 graph 데이터를 그대로 박제하여 저장
    graph_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # ⚙️ 채널별 추가 설정 (확장성)
    # 예: Slack channel_id, Widget theme 등 가변적인 설정값
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # 📝 메타데이터
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ⏯️ 활성 상태
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Workflow 모델과의 관계 설정
    workflow = relationship("Workflow", back_populates="deployments")
