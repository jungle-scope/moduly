from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from db.models.user import User
from db.session import get_db
from services.auth_service import ALGORITHM, SECRET_KEY


def get_current_user(
    db: Session = Depends(get_db), auth_token: Optional[str] = Cookie(default=None)
) -> User:
    """
    httpOnly 쿠키에 담긴 JWT(auth_token)로 현재 로그인한 사용자를 조회합니다.
    - 토큰 없음/만료/위조 → 401
    - 토큰의 user_id가 DB에 없으면 401
    """
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def get_current_user_id(user: User = Depends(get_current_user)):
    """현재 로그인한 사용자의 UUID만 필요할 때 사용."""
    return user.id
