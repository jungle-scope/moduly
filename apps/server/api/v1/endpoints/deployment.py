from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.user import User
from db.session import get_db
from schemas.deployment import DeploymentCreate, DeploymentResponse
from services.deployment_service import DeploymentService

router = APIRouter()


@router.post("/", response_model=DeploymentResponse)
def create_deployment(
    deployment_in: DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    워크플로우를 배포합니다.
    """
    return DeploymentService.create_deployment(db, deployment_in, current_user.id)


@router.get("/", response_model=List[DeploymentResponse])
def get_deployments(
    workflow_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 워크플로우의 배포 이력을 조회합니다.
    """
    return DeploymentService.list_deployments(db, workflow_id, skip, limit)


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 배포 ID의 상세 정보를 조회합니다.
    """
    return DeploymentService.get_deployment(db, deployment_id)
