"""배포 관리 엔드포인트"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.db.models.workflow_deployment import WorkflowDeployment
from apps.shared.db.models.app import App
from apps.shared.schemas.deployment import (
    DeploymentCreate,
    DeploymentResponse,
    DeploymentInfoResponse,
)

router = APIRouter()


@router.get("/", response_model=List[DeploymentResponse])
async def list_deployments(
    app_id: UUID = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """배포 목록 조회"""
    query = db.query(WorkflowDeployment)
    
    if app_id:
        query = query.filter(WorkflowDeployment.app_id == app_id)
    
    deployments = query.offset(skip).limit(limit).all()
    return deployments


@router.post("/", response_model=DeploymentResponse)
async def create_deployment(
    request: DeploymentCreate,
    db: Session = Depends(get_db),
):
    """배포 생성"""
    # TODO: 인증된 사용자 정보 연결
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
):
    """배포 상세 조회"""
    deployment = db.query(WorkflowDeployment).filter(WorkflowDeployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    return deployment


@router.get("/info/{url_slug}", response_model=DeploymentInfoResponse)
async def get_deployment_info(
    url_slug: str,
    db: Session = Depends(get_db),
):
    """
    공개 배포 정보 조회 (인증 불필요)
    
    위젯/웹앱 표시용
    """
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app or not app.active_deployment_id:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    
    deployment = db.query(WorkflowDeployment).filter(
        WorkflowDeployment.id == app.active_deployment_id
    ).first()
    
    if not deployment:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    
    return DeploymentInfoResponse(
        url_slug=url_slug,
        version=deployment.version,
        description=deployment.description,
        type=deployment.type.value,
        input_schema=deployment.input_schema,
        output_schema=deployment.output_schema,
    )


@router.delete("/{deployment_id}")
async def delete_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
):
    """배포 삭제"""
    deployment = db.query(WorkflowDeployment).filter(WorkflowDeployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    
    db.delete(deployment)
    db.commit()
    return {"message": "삭제 완료", "deployment_id": str(deployment_id)}
