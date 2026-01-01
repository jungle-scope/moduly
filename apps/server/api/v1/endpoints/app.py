from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.user import User
from db.session import get_db
from schemas.app import AppCreateRequest, AppResponse, AppUpdateRequest
from services.app_service import AppService

router = APIRouter()


@router.patch("/{app_id}", response_model=AppResponse)
def update_app(
    app_id: str,
    request: AppUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    앱 정보를 수정합니다. (본인 앱만)
    """
    app = AppService.update_app(db, app_id, request, user_id=str(current_user.id))
    if not app:
        raise HTTPException(status_code=404, detail="App not found or permission denied")
    return app


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


@router.get("/explore", response_model=List[AppResponse])
def list_explore_apps(
    db: Session = Depends(get_db),
    # 탐색 페이지는 공개 접근을 의미하지만, 보통 사용자는 여전히 로그인 상태입니다.
    # 로그인 없이 공개 접근을 원한다면 current_user 의존성을 제거하면 됩니다.
    # 현재 시스템 설계상 복제/조회를 위해 로그인이 필요하다고 가정합니다.
    current_user: User = Depends(get_current_user),
):
    """
    공개된 앱 목록 조회 (커뮤니티 탐색)
    """
    return AppService.list_explore_apps(db, user_id=str(current_user.id))


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


@router.delete("/{app_id}")
def delete_app(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    앱을 삭제합니다. (본인 앱만)
    """
    result = AppService.delete_app(db, app_id, user_id=str(current_user.id))
    if not result:
        # 삭제 실패 (존재하지 않거나 권한 없음)
        raise HTTPException(status_code=404, detail="App not found or permission denied")
    
    return {"message": "App deleted successfully"}
