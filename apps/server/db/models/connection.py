import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from db.base import Base


class Connection(Base):
    """
    외부 DB 연결정보를 저장하는 모델.
    비밀번호와 같은 민감한 정보는 반드시 암호화되어 저장되어야 합니다.
    """

    __tablename__ = "connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 어떤 사용자가 생성한 연결인지 식별
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String, nullable=False)  # postgres, mysql..

    host = Column(String, nullable=False)
    port = Column(Integer, default=5432, nullable=False)
    database = Column(String, nullable=False)
    username = Column(String, nullable=False)

    # 비밀번호는 암호화된 값을 저장합니다. (base64)
    encrypted_password = Column(Text, nullable=False)

    # SSH 터널링 설정 (옵션)
    use_ssh = Column(Boolean, default=False, nullable=False)
    ssh_host = Column(String, nullable=True)
    ssh_port = Column(Integer, default=22, nullable=True)
    ssh_username = Column(String, nullable=True)

    ssh_auth_type = Column(String, default="password", nullable=True)

    # SSH 민감정보 (암호화)
    encrypted_ssh_password = Column(Text, nullable=True)
    encrypted_ssh_private_key = Column(Text, nullable=True)

    # TODO: user 모델 파일에서도 relationship 정의해주고 주석 풀기
    # user = relationship("User", back_populates="connections")
