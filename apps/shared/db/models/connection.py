import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from apps.shared.db.base import Base


class Connection(Base):
    """
    외부 DB 연결정보를 저장하는 모델.
    비밀번호와 같은 민감한 정보는 반드시 암호화되어 저장되어야 합니다.
    """

    __tablename__ = "connections"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    # 어떤 사용자가 생성한 연결인지 식별
    user_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)  # postgres, mysql..
    host: Mapped[str] = mapped_column(String, nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=5432, nullable=False)

    database: Mapped[str] = mapped_column(String, nullable=False)
    username: Mapped[str] = mapped_column(String, nullable=False)
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)

    # SSH 터널링 설정 (옵션)
    use_ssh: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ssh_host: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ssh_port: Mapped[Optional[int]] = mapped_column(Integer, default=22, nullable=True)
    ssh_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ssh_auth_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # SSH 민감정보 (암호화)
    encrypted_ssh_password: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    encrypted_ssh_private_key: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    # Relationship
    # user = relationship("User", back_populates="connections")
