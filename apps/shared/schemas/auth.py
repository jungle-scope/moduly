from datetime import datetime

from pydantic import BaseModel, EmailStr


# ==================== 요청 스키마 ====================
class LoginRequest(BaseModel):
    """로그인 요청"""

    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    """회원가입 요청"""

    email: EmailStr
    password: str
    name: str


# ==================== 응답 스키마 ====================
class UserResponse(BaseModel):
    """사용자 정보 응답"""

    id: str
    email: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy 모델 -> Pydantic 변환 허용


class SessionInfo(BaseModel):
    """세션 정보"""

    token: str
    expires_at: datetime


class LoginResponse(BaseModel):
    """로그인/회원가입 성공 응답"""

    user: UserResponse
    session: SessionInfo
