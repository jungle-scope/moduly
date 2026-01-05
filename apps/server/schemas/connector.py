from typing import Literal, Optional

from pydantic import BaseModel, Field


# SSH 설정 스키마
class SSHConfig(BaseModel):
    enabled: bool = False
    host: Optional[str] = None
    port: int = 22
    username: Optional[str] = None
    auth_type: Literal["password", "key"] = "password"
    password: Optional[str] = None
    private_key: Optional[str] = None


# DB연결 테스트 요청 본문 스키마
class DBConnectionTestRequest(BaseModel):
    connection_name: str = Field(..., description="연결 식별을 위한 별칭")
    type: str = Field(..., description="데이터베이스 타입 (예: postgres)")

    host: str
    port: int = 5432
    database: str
    username: str
    password: str
    ssh: Optional[SSHConfig] = None


# 테스트 결과 응답 스키마
class DBConnectionTestResponse(BaseModel):
    success: bool
    message: str


class DBConnectionDetailResponse(BaseModel):
    id: str
    connection_name: str
    type: str
    host: str
    port: int
    database: str
    username: str
    # Password is explicitly excluded for security

    ssh: Optional[dict] = None  # Or define a specific SSH schema
