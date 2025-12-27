from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import LoginRequest, LoginResponse, SignupRequest
from services.auth_service import AuthService

router = APIRouter()


@router.post("/signup", response_model=LoginResponse)
def signup(request: SignupRequest, response: Response, db: Session = Depends(get_db)):
    """
    이메일/비밀번호 회원가입

    Args:
        request: 회원가입 요청 (email, password, name)
        response: FastAPI Response (쿠키 설정용)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    result = AuthService.signup(db, request)

    # httpOnly 쿠키 설정 (XSS 공격 방지)
    response.set_cookie(
        key="auth_token",
        value=result.session.token,
        httponly=True,  # JavaScript 접근 차단
        secure=False,  # 개발: False, 프로덕션: True (HTTPS only)
        samesite="lax",  # CSRF 방지
        max_age=604800,  # 7일 (초 단위)
        path="/",  # 모든 경로에서 사용 가능
    )

    return result


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    이메일/비밀번호 로그인

    Args:
        request: 로그인 요청 (email, password)
        response: FastAPI Response (쿠키 설정용)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    result = AuthService.login(db, request)

    # httpOnly 쿠키 설정 (XSS 공격 방지)
    response.set_cookie(
        key="auth_token",
        value=result.session.token,
        httponly=True,  # JavaScript 접근 차단
        secure=False,  # 개발: False, 프로덕션: True (HTTPS only)
        samesite="lax",  # CSRF 방지
        max_age=604800,  # 7일 (초 단위)
        path="/",  # 모든 경로에서 사용 가능
    )

    return result


@router.post("/logout")
def logout(response: Response):
    """로그아웃 - 쿠키 삭제"""
    response.delete_cookie(key="auth_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/google/login")
def google_login():
    """
    구글 OAuth 로그인 시작
    """
    # TODO: 구글 OAuth 로직 구현
    return {"message": "Google login endpoint - implementation needed"}


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    """
    구글 OAuth 콜백 처리
    """
    # TODO: 구글 콜백 로직 구현
    return {"message": "Google callback endpoint - implementation needed", "code": code}
