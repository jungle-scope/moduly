import os

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth.oauth import oauth
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


# -----------------------------------------------------------------------------
# Google OAuth
# -----------------------------------------------------------------------------


@router.get("/google/login")
async def google_login(request: Request):
    """
    구글 로그인 리디렉션
    - 로컬/배포 환경에 따라 redirect_uri를 동적으로 생성
    """
    # url_for는 현재 요청의 Host 헤더(또는 Forwarded 헤더)를 기반으로 절대 경로 생성
    redirect_uri = request.url_for("auth_google_callback")

    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def auth_google_callback(
    request: Request, response: Response, db: Session = Depends(get_db)
):
    """
    구글 로그인 콜백
    """
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        # 인증 실패 시 로그인 페이지로 리디렉션 (에러 파라미터 포함 등)
        print(f"OAuth Error: {e}")
        return Response(status_code=400, content=f"OAuth Authentication Failed: {e}")

    # 사용자 정보 추출
    user_info = token.get("userinfo")
    if not user_info:
        user_info = await oauth.google.userinfo(token=token)

    email = user_info.get("email")
    name = user_info.get("name", "Unknown")
    # Google의 sub 필드가 고유 ID
    social_id = user_info.get("sub")
    picture = user_info.get("picture")

    if not email:
        return Response(status_code=400, content="Email not found in Google account")

    # 사용자 조회 또는 생성
    user = AuthService.get_or_create_social_user(
        db=db,
        email=email,
        name=name,
        social_provider="google",
        social_id=social_id,
        avatar_url=picture,
    )

    # 자체 JWT 토큰 생성
    access_token = AuthService.create_jwt_token(str(user.id))

    # 쿠키 설정
    is_production, cookie_domain = _get_cookie_config(request)

    # 리디렉션 URL 설정
    # 로컬 개발 환경(proxy 없이 직접 접근)에서는 프론트엔드 포트(3000)로 리디렉션 필요할 수 있음
    # 하지만 사용자는 Nginx Reverse Proxy를 사용하는 것으로 추정됨 (8000/3000 분리?)
    # 사용자의 요청: "url의 경우 로컬과 배포 환경에서 둘 다 동작하게 하고 싶어"
    # 스마트 감지: Referer를 확인하거나, 혹은 /dashboard로 리디렉션하면
    # 같은 도메인/포트 서빙이면 문제 없음.
    # 만약 Nginx가 80포트에서 /api는 백엔드로, /는 프론트로 보낸다면 /dashboard로 충분.
    # 로컬에서 localhost:3000(프론트), localhost:8000(백엔드)로 따로 띄운다면
    # localhost:8000에서 localhost:3000으로 리디렉션 필요.

    dashboard_url = "/dashboard"

    # 호스트가 localhost:8000이면 -> localhost:3000으로 보냄 (개발 편의성)
    host = request.headers.get("host", "")
    if "localhost:8000" in host or "127.0.0.1:8000" in host:
        dashboard_url = "http://localhost:3000/dashboard"

    redirect_response = RedirectResponse(url=dashboard_url, status_code=302)
    redirect_response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        domain=cookie_domain,
        max_age=6 * 60 * 60,
    )

    return redirect_response
