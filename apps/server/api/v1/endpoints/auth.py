import os

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import LoginRequest, LoginResponse, SignupRequest
from services.auth_service import AuthService

router = APIRouter()


def _get_cookie_config(request: Request) -> tuple[bool, str | None]:
    """
    환경 감지 및 쿠키 도메인 설정 헬퍼 함수

    Returns:
        (is_production, cookie_domain)
    """
    host = request.headers.get("host", "")
    is_production = "localhost" not in host and "127.0.0.1" not in host

    # 쿠키 도메인 (환경변수 우선, 없으면 호스트에서 자동 추출)
    cookie_domain = os.getenv("COOKIE_DOMAIN")
    if not cookie_domain and is_production:
        # api.moviepick.shop → .moviepick.shop
        parts = host.split(".")
        if len(parts) >= 2:
            cookie_domain = f".{'.'.join(parts[-2:])}"

    return is_production, cookie_domain


@router.post("/signup", response_model=LoginResponse)
def signup(
    request_obj: Request,
    request: SignupRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    이메일/비밀번호 회원가입

    Args:
        request_obj: FastAPI Request (호스트 확인용)
        request: 회원가입 요청 (email, password, name)
        response: FastAPI Response (쿠키 설정용)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    result = AuthService.signup(db, request)

    # 환경 감지 및 쿠키 도메인 설정
    is_production, cookie_domain = _get_cookie_config(request_obj)

    cookie_params = {
        "key": "auth_token",
        "value": result.session.token,
        "httponly": True,
        "samesite": "none" if is_production else "lax",
        "max_age": 21600,  # 6시간
        "path": "/",
    }

    if is_production:
        cookie_params["secure"] = True
        if cookie_domain:
            cookie_params["domain"] = cookie_domain
    else:
        cookie_params["secure"] = False

    response.set_cookie(**cookie_params)

    return result


@router.post("/login", response_model=LoginResponse)
def login(
    request_obj: Request,
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    이메일/비밀번호 로그인

    Args:
        request_obj: FastAPI Request (호스트 확인용)
        request: 로그인 요청 (email, password)
        response: FastAPI Response (쿠키 설정용)
        db: 데이터베이스 세션

    Returns:
        LoginResponse: 사용자 정보 + JWT 토큰
    """
    result = AuthService.login(db, request)

    # 환경 감지 및 쿠키 도메인 설정
    is_production, cookie_domain = _get_cookie_config(request_obj)

    cookie_params = {
        "key": "auth_token",
        "value": result.session.token,
        "httponly": True,
        "samesite": "none" if is_production else "lax",
        "max_age": 21600,  # 6시간
        "path": "/",
    }

    if is_production:
        cookie_params["secure"] = True
        if cookie_domain:
            cookie_params["domain"] = cookie_domain
    else:
        cookie_params["secure"] = False

    response.set_cookie(**cookie_params)

    return result


@router.post("/logout")
def logout(request_obj: Request, response: Response):
    """로그아웃 - 쿠키 삭제"""
    # 환경 감지 및 쿠키 도메인 설정
    _, cookie_domain = _get_cookie_config(request_obj)

    # 쿠키 삭제 (설정 시와 동일한 domain으로)
    delete_params = {"key": "auth_token", "path": "/"}
    if cookie_domain:
        delete_params["domain"] = cookie_domain

    response.delete_cookie(**delete_params)
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
