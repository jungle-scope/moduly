"""앱 관리 엔드포인트"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.db.models.app import App
from apps.shared.schemas.app import AppCreateRequest, AppUpdateRequest, AppResponse

router = APIRouter()


@router.get("/", response_model=List[AppResponse])
async def list_apps(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """앱 목록 조회"""
    apps = db.query(App).offset(skip).limit(limit).all()
    return apps


@router.post("/", response_model=AppResponse)
async def create_app(
    request: AppCreateRequest,
    db: Session = Depends(get_db),
):
    """앱 생성"""
    # TODO: 인증된 사용자 정보 연결
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{app_id}", response_model=AppResponse)
async def get_app(
    app_id: UUID,
    db: Session = Depends(get_db),
):
    """앱 상세 조회"""
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="앱을 찾을 수 없습니다")
    return app


@router.put("/{app_id}", response_model=AppResponse)
async def update_app(
    app_id: UUID,
    request: AppUpdateRequest,
    db: Session = Depends(get_db),
):
    """앱 수정"""
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="앱을 찾을 수 없습니다")
    
    # 업데이트
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(app, key, value)
    
    db.commit()
    db.refresh(app)
    return app


@router.delete("/{app_id}")
async def delete_app(
    app_id: UUID,
    db: Session = Depends(get_db),
):
    """앱 삭제"""
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="앱을 찾을 수 없습니다")
    
    db.delete(app)
    db.commit()
    return {"message": "삭제 완료", "app_id": str(app_id)}
