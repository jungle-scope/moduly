from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.app import AppCreateRequest, AppResponse
from services.app_service import AppService

router = APIRouter()


@router.post("", response_model=AppResponse)
def create_app(request: AppCreateRequest, db: Session = Depends(get_db)):
    """
    새로운 앱을 생성합니다.

    Args:
        request: 앱 생성 요청 데이터 (name, description, icon, icon_background)
        db: 데이터베이스 세션 (의존성 주입)

    Returns:
        생성된 앱 정보
    """
    return AppService.create_app(db, request)


@router.get("/{app_id}", response_model=AppResponse)
def get_app(app_id: str, db: Session = Depends(get_db)):
    """
    앱을 ID로 조회합니다.
    """
    app = AppService.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app
