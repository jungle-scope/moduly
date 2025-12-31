from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.user import User
from db.session import get_db
from schemas.app import AppCreateRequest, AppResponse
from services.app_service import AppService

router = APIRouter()


@router.post("", response_model=AppResponse)
def create_app(
    request: AppCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    새로운 앱을 생성합니다. (인증 필요)
    """
    return AppService.create_app(db, request, user_id=str(current_user.id))


@router.get("", response_model=List[AppResponse])
def list_apps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    현재 유저의 앱 목록 조회
    """
    apps = AppService.list_apps(db, user_id=str(current_user.id))
    return apps


@router.get("/{app_id}", response_model=AppResponse)
def get_app(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    앱을 ID로 조회합니다. (본인 앱만)
    """
    app = AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    if app.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return app


@router.post("/{app_id}/clone", response_model=AppResponse)
def clone_app(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    앱을 복제합니다. (내 스튜디오로 복사)
    """
    app = AppService.clone_app(db, user_id=str(current_user.id), app_id=app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    return app
