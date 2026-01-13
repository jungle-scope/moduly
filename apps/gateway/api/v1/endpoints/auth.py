"""인증 엔드포인트"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.schemas.auth import LoginRequest, SignupRequest, LoginResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """로그인"""
    # TODO: 기존 auth 로직 연결
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/signup", response_model=LoginResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """회원가입"""
    # TODO: 기존 auth 로직 연결
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/me")
async def get_current_user(db: Session = Depends(get_db)):
    """현재 사용자 정보"""
    # TODO: 인증 미들웨어 연결
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/logout")
async def logout():
    """로그아웃"""
    return {"message": "로그아웃 완료"}
