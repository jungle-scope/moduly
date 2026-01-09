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
ACCESS_TOKEN_EXPIRE_HOURS = 6  # 6시간


class AuthService:
    """인증 서비스 - 회원가입, 로그인, 비밀번호 관리 (JWT 기반) + 소셜 로그인"""

    @staticmethod
    def get_or_create_social_user(
        db: Session,
        email: str,
        name: str,
        social_provider: str,
        social_id: str,
        avatar_url: str | None = None,
    ) -> User:
        """
        소셜 로그인 처리:
        1. email로 사용자 조회
        2. 있으면 반환 (필요시 social info 업데이트)
        3. 없으면 새로 생성 후 반환
        """
        user = db.query(User).filter(User.email == email).first()

        if user:
            # 기존 유저가 있다면 소셜 정보 업데이트 (최초 연동 시 등)
            is_updated = False
            if user.social_provider != social_provider:
                user.social_provider = social_provider
                is_updated = True
            if user.social_id != social_id:
                user.social_id = social_id
                is_updated = True
            if avatar_url and user.avatar_url != avatar_url:
                user.avatar_url = avatar_url
                is_updated = True

            if is_updated:
                db.commit()
                db.refresh(user)

            return user

        # 신규 유저 생성
        new_user = User(
            email=email,
            name=name,
            social_provider=social_provider,
            social_id=social_id,
            avatar_url=avatar_url,
            # password는 null
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

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
            hours=ACCESS_TOKEN_EXPIRE_HOURS
        )
        payload = {
            "user_id": user_id,
            "exp": expires_at,
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    @staticmethod
    def get_token_expiry() -> datetime:
        """토큰 만료 시간 (6시간 후)"""
        return datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    @staticmethod
    def verify_jwt_token(token: str) -> str | None:
        """
        JWT 토큰 검증

        Args:
            token: JWT 토큰

        Returns:
            str | None: 유효한 경우 user_id, 그렇지 않으면 None
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("user_id")
            return user_id
        except jwt.JWTError:
            return None

    @staticmethod
    def get_user_from_token(db: Session, token: str | None) -> User:
        """
        JWT 토큰으로 사용자 조회 (재사용 가능한 헬퍼 메서드)

        Args:
            db: 데이터베이스 세션
            token: JWT 토큰

        Returns:
            User: 사용자 객체

        Raises:
            HTTPException: 인증 실패 시 401 에러
        """
        from fastapi import HTTPException

        # 토큰 없음
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # 토큰 검증
        user_id = AuthService.verify_jwt_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # 사용자 조회
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

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
