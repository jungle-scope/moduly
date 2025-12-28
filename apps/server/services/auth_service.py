"""인증 관련 서비스 로직"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt
from sqlalchemy.orm import Session

from db.models.user import User
from schemas.auth import (
    LoginRequest,
    LoginResponse,
    SessionInfo,
    SignupRequest,
    UserResponse,
)

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


class AuthService:
    """인증 서비스 - 회원가입, 로그인, 비밀번호 관리 (JWT 기반)"""

    @staticmethod
    def hash_password(password: str) -> str:
        """비밀번호 해싱 (SHA-256 + salt)"""
        salt = secrets.token_hex(16)
        hashed = hashlib.sha256((password + salt).encode()).hexdigest()
        return f"{salt}${hashed}"

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """비밀번호 검증"""
        try:
            salt, stored_hash = hashed_password.split("$")
            new_hash = hashlib.sha256((password + salt).encode()).hexdigest()
            return new_hash == stored_hash
        except ValueError:
            return False

    @staticmethod
    def create_jwt_token(user_id: str) -> str:
        """JWT 토큰 생성"""
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=ACCESS_TOKEN_EXPIRE_DAYS
        )
        payload = {
            "user_id": user_id,
            "exp": expires_at,
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    @staticmethod
    def get_token_expiry() -> datetime:
        """토큰 만료 시간 (7일 후)"""
        return datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    @staticmethod
    def signup(db: Session, request: SignupRequest) -> LoginResponse:
        """
        회원가입 처리 (JWT 기반)

        Args:
            db: 데이터베이스 세션
            request: 회원가입 요청 (email, password, name)

        Returns:
            LoginResponse: 사용자 정보 + JWT 토큰

        Raises:
            HTTPException: 이메일 중복 시 400 에러
        """
        # 이메일 중복 확인
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Email already registered")

        # 사용자 생성
        hashed_pwd = AuthService.hash_password(request.password)
        new_user = User(
            email=request.email,
            name=request.name,
            password=hashed_pwd,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # JWT 토큰 생성 (세션 DB 저장 없음)
        token = AuthService.create_jwt_token(user_id=str(new_user.id))
        expires_at = AuthService.get_token_expiry()

        # 응답 생성
        return LoginResponse(
            user=UserResponse(
                id=str(new_user.id),
                email=new_user.email,
                name=new_user.name,
                created_at=new_user.created_at,
            ),
            session=SessionInfo(
                token=token,
                expires_at=expires_at,
            ),
        )

    @staticmethod
    def login(db: Session, request: LoginRequest) -> LoginResponse:
        """
        로그인 처리 (JWT 기반)

        Args:
            db: 데이터베이스 세션
            request: 로그인 요청 (email, password)

        Returns:
            LoginResponse: 사용자 정보 + JWT 토큰

        Raises:
            HTTPException: 인증 실패 시 401 에러
        """
        # 사용자 찾기
        user = db.query(User).filter(User.email == request.email).first()
        if not user or not user.password:
            from fastapi import HTTPException

            raise HTTPException(status_code=401, detail="Invalid email or password")

        # 비밀번호 검증
        if not AuthService.verify_password(request.password, user.password):
            from fastapi import HTTPException

            raise HTTPException(status_code=401, detail="Invalid email or password")

        # JWT 토큰 생성 (세션 DB 저장 없음)
        token = AuthService.create_jwt_token(user_id=str(user.id))
        expires_at = AuthService.get_token_expiry()

        # 응답 생성
        return LoginResponse(
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                name=user.name,
                created_at=user.created_at,
            ),
            session=SessionInfo(
                token=token,
                expires_at=expires_at,
            ),
        )
