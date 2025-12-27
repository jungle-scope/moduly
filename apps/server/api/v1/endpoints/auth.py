from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import LoginRequest, LoginResponse, SignupRequest
from services.auth_service import AuthService

router = APIRouter()


@router.post("/signup", response_model=LoginResponse)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """
    이메일/비밀번호 회원가입

    Args:
        request: 회원가입 요청 (email, password, name)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    return AuthService.signup(db, request)


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    이메일/비밀번호 로그인

    Args:
        request: 로그인 요청 (email, password)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    return AuthService.login(db, request)


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
