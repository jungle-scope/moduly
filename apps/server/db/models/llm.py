import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from db.models.user import User


class LLMProvider(Base):
    """
    LLM provider metadata and default credential reference.

    - 한 줄 요약: "OpenAI" 같은 제공자 정보를 저장하는 표
    - 한 사용자가 여러 provider를 가질 수 있음
    - credential_id로 기본 자격증명을 가리킴 (없으면 None)
    """

    __tablename__ = "llm_provider"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # 예: "openai", "anthropic"
    provider_name: Mapped[str] = mapped_column(Text, nullable=False)
    # 예: "system", "custom" 등 분류용
    provider_type: Mapped[str] = mapped_column(Text, nullable=False, default="custom")
    credential_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_credentials.id"), nullable=True
    )
    # quota_type: tokens, credits, requests, none
    quota_type: Mapped[str] = mapped_column(Text, nullable=False, default="none")
    # quota_limit: -1 이면 무제한
    quota_limit: Mapped[int] = mapped_column(BigInteger, nullable=False, default=-1)
    quota_used: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # timezone-aware 기록을 위해 utcnow 대신 now(timezone.utc) 사용, DateTime은 timezone=True
    # lambda로 감싸 실행 시점 평가 보장
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # 한 provider는 여러 credential을 가질 수 있음 (1:N)
    credentials: Mapped[List["LLMCredential"]] = relationship(
        "LLMCredential", back_populates="provider"
    )
    # 기본으로 사용할 credential (없을 수도 있음)
    default_credential: Mapped[Optional["LLMCredential"]] = relationship(
        "LLMCredential",
        foreign_keys=[credential_id],
        uselist=False,
        post_update=True,
    )
    # 어떤 사용자의 provider인지 연결
    user: Mapped["User"] = relationship("User")


class LLMCredential(Base):
    """
    Encrypted credentials for an LLM provider.

    - 한 줄 요약: provider와 연결된 API Key 등 민감정보를 저장
    - encrypted_config 필드에 암호화된 설정을 텍스트로 보관
    """

    __tablename__ = "llm_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_provider.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # 사람이 구분하기 쉬운 라벨 (예: "내 OpenAI 키")
    credential_name: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_config: Mapped[str] = mapped_column(Text, nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # timezone-aware 기록을 위해 utcnow 대신 now(timezone.utc) 사용, DateTime은 timezone=True
    # lambda로 감싸 실행 시점 평가 보장
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # 소속 provider
    provider: Mapped["LLMProvider"] = relationship(
        "LLMProvider", back_populates="credentials"
    )
    # 어떤 사용자가 만든 credential인지 연결
    # (현재는 역참조 back_populates를 두지 않고 단방향으로 둠)
    user: Mapped["User"] = relationship("User")
