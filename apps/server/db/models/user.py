import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from db.base import Base


class User(Base):
    """사용자 프로필 테이블 (서비스 전반에서 사용)"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password = Column(String(255), nullable=True)  # credential 로그인용 (OAuth는 null)
    social_provider = Column(String(50), nullable=False)  # 예: 'google', 'none'
    social_id = Column(String(255), nullable=True)  # provider별 고유 ID
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # TODO: tenant_id 추가.
