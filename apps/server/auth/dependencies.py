"""JWT 인증 Dependency 함수들"""

import os
from typing import Optional

from fastapi import Cookie, Depends, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from db.models.user import User
from db.session import get_db

# JWT 설정 (auth_service.py와 동일하게)
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"


async def get_current_user(
    auth_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)
) -> User:
    """
    쿠키에서 JWT 토큰을 추출하고, 현재 로그인한 사용자를 반환합니다.

    Args:
        auth_token: 쿠키에서 추출한 JWT 토큰
        db: 데이터베이스 세션

    Returns:
        User: 현재 로그인한 사용자

    Raises:
        HTTPException: 인증되지 않은 요청 시 401 에러
    """
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # JWT 디코딩
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")

        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        # 사용자 조회
        user = db.query(User).filter(User.id == user_id).first()

        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user_optional(
    auth_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)
) -> Optional[User]:
    """
    로그인 선택인 엔드포인트용. 토큰 없어도 None 반환.

    Args:
        auth_token: 쿠키에서 추출한 JWT 토큰
        db: 데이터베이스 세션

    Returns:
        User | None: 로그인한 사용자 또는 None
    """
    if not auth_token:
        return None

    try:
        return await get_current_user(auth_token, db)
    except HTTPException:
        return None
