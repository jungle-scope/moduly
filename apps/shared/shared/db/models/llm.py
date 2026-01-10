import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Text, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base

# === Legacy Models (Mapped to renamed tables for reference/migration) ===
class LegacyLLMProvider(Base):
    __tablename__ = "legacy_llm_provider"
    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    # ... (simplified)

class LegacyLLMCredential(Base):
    __tablename__ = "legacy_llm_credentials"
    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    # ... (simplified)

# === New Models ===

class LLMProvider(Base):
    """
    LLM 공급사 정보 (예: OpenAI, Google)
    시스템 전체 공통 데이터. 변경이 거의 없음.
    """
    __tablename__ = "llm_providers"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)  # ex: openai
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(Text, nullable=False, default="system") # system, custom
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    auth_type: Mapped[str] = mapped_column(Text, nullable=False) # api_key, oauth, aws_sigv4
    doc_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relations
    models: Mapped[List["LLMModel"]] = relationship("LLMModel", back_populates="provider", cascade="all, delete-orphan")
    credentials: Mapped[List["LLMCredential"]] = relationship("LLMCredential", back_populates="provider")


class LLMModel(Base):
    """
    Provider가 제공하는 모델 목록 (예: gpt-4, claude-2)
    시스템 전역 카탈로그.
    """
    __tablename__ = "llm_models"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_providers.id", ondelete="CASCADE"), nullable=False
    )
    model_id_for_api_call: Mapped[str] = mapped_column(Text, nullable=False) # ex: gpt-4o
    name: Mapped[str] = mapped_column(Text, nullable=False) # ex: GPT-4o (Omni)
    type: Mapped[str] = mapped_column(Text, nullable=False, default="chat") # chat, embedding
    context_window: Mapped[int] = mapped_column(Integer, nullable=False, default=4096)
    
    input_price_1k: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    output_price_1k: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    model_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relations
    provider: Mapped["LLMProvider"] = relationship("LLMProvider", back_populates="models")
    usage_logs: Mapped[List["LLMUsageLog"]] = relationship("LLMUsageLog", back_populates="model")
    # M:N mapping through LLMRelCredentialModel is usually handled explicitly or via association proxy if needed

    @property
    def provider_name(self) -> str:
        return self.provider.name if self.provider else "Unknown"


class LLMCredential(Base):
    """
    유저가 저장한 인증 정보 (예: API Key)
    """
    __tablename__ = "llm_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_providers.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), nullable=True # Tenant FK would go here
    )
    credential_name: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_config: Mapped[str] = mapped_column(Text, nullable=False) # Encrypted JSON or string
    config_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # sk-****
    
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Quota
    quota_type: Mapped[str] = mapped_column(Text, nullable=False, default="none")
    quota_limit: Mapped[int] = mapped_column(BigInteger, nullable=False, default=-1)
    quota_used: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relations
    provider: Mapped["LLMProvider"] = relationship("LLMProvider", back_populates="credentials")
    user: Mapped["User"] = relationship("db.models.user.User") # Avoid circular import if possible, or use string
    usage_logs: Mapped[List["LLMUsageLog"]] = relationship("LLMUsageLog", back_populates="credential")


class LLMRelCredentialModel(Base):
    """
    Credential <-> Model 매핑 (가용 모델/권한)
    """
    __tablename__ = "llm_rel_credential_models"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    credential_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_credentials.id", ondelete="CASCADE"), nullable=False
    )
    model_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_models.id", ondelete="CASCADE"), nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LLMUsageLog(Base):
    """
    LLM 사용 로그
    """
    __tablename__ = "llm_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    credential_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_credentials.id", ondelete="SET NULL"), nullable=True
    )
    model_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("llm_models.id", ondelete="SET NULL"), nullable=True
    )
    
    workflow_id: Mapped[Optional[uuid.UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True) # FK later
    # [NEW] 워크플로우 실행 ID 추가 (어떤 실행에서 호출되었는지 추적)
    workflow_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="SET NULL"), nullable=True
    )
    node_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cost: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="success")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    credential: Mapped["LLMCredential"] = relationship("LLMCredential", back_populates="usage_logs")
    model: Mapped["LLMModel"] = relationship("LLMModel", back_populates="usage_logs")
