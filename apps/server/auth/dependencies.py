"""
JWT 인증 Dependency 함수들

FastAPI의 Depends와 함께 사용하기 위한 의존성 주입 함수들.
실제 비즈니스 로직은 services.auth_service.AuthService에 위임.
"""

from typing import Optional

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from apps.shared.db.models.user import User
from apps.shared.db.session import get_db
from services.auth_service import AuthService


async def get_current_user(
    auth_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)
) -> User:
    """
    쿠키에서 JWT 토큰을 추출하고, 현재 로그인한 사용자를 반환합니다.
    FastAPI Depends와 함께 사용하기 위한 의존성 함수.

    Args:
        auth_token: 쿠키에서 추출한 JWT 토큰
        db: 데이터베이스 세션

    Returns:
        User: 현재 로그인한 사용자

    Raises:
        HTTPException: 인증되지 않은 요청 시 401 에러

    Usage:
        @router.get("/protected")
        def protected_route(user: User = Depends(get_current_user)):
            return {"user_id": user.id}
    """
    # AuthService의 비즈니스 로직 재사용
    return AuthService.get_user_from_token(db, auth_token)
