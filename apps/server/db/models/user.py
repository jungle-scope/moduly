import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from db.base import Base


class User(Base):
    """사용자 프로필 테이블 (서비스 전반에서 사용)"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password = Column(String(255), nullable=True)  # credential 로그인용 (OAuth는 null)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Account(Base):
    """OAuth 로그인 정보 테이블"""

    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    provider_id = Column(String(50), nullable=False)  # 'google', 'github', 'credential'
    account_id = Column(String(255), nullable=False)  # 제공자의 사용자 고유 ID
    password = Column(String(255), nullable=True)  # credential 로그인 시에만 사용
    access_token = Column(Text, nullable=True)  # OAuth access token


class Session(Base):
    """
    세션 정보 관리 테이블
    현재는 JWT 기반 인증 방식을 사용해서 필요 없지만, 나중에 refresh 토큰이나 강제 로그아웃 등 세션이 필요할 경우를 대비해 남겨두었습니다.
    """

    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(500), unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
