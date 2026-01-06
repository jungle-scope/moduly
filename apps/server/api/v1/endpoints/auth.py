from fastapi import APIRouter, Depends, Request, Response
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
        secure=True,  # HTTPS + Cross-origin 지원
        samesite="none",  # Cross-origin 허용 (localhost ↔ remote)
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
        secure=True,  # HTTPS + Cross-origin 지원
        samesite="none",  # Cross-origin 허용 (localhost ↔ remote)
        max_age=604800,  # 7일 (초 단위)
        path="/",  # 모든 경로에서 사용 가능
    )

    return result


@router.post("/logout")
def logout(response: Response):
    """로그아웃 - 쿠키 삭제"""
    response.delete_cookie(key="auth_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=LoginResponse)
def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    현재 로그인된 사용자 정보 조회

    Args:
        request: FastAPI Request (쿠키 읽기용)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + 세션 정보
    """

    # 쿠키에서 토큰 가져오기
    token = request.cookies.get("auth_token")
    user = AuthService.get_user_from_token(db, token)

    from schemas.auth import SessionInfo, UserResponse

    return LoginResponse(
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            created_at=user.created_at,
        ),
        session=SessionInfo(
            token=token,
            expires_at=AuthService.get_token_expiry(),
        ),
    )


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
