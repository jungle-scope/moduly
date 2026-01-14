from typing import List

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.deployment_service import DeploymentService
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db
from apps.shared.schemas.deployment import DeploymentCreate, DeploymentResponse

router = APIRouter()


@router.post("", response_model=DeploymentResponse)
def create_deployment(
    deployment_in: DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    워크플로우를 배포합니다.
    """
    return DeploymentService.create_deployment(db, deployment_in, current_user.id)


@router.get("", response_model=List[DeploymentResponse])
def get_deployments(
    app_id: str = None,
    workflow_id: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 앱의 배포 이력을 조회합니다.
    app_id 또는 workflow_id 중 하나는 필수입니다.
    """
    return DeploymentService.list_deployments(
        db,
        app_id=app_id,
        workflow_id=workflow_id,
        skip=skip,
        limit=limit,
    )


@router.get("/nodes", response_model=List[dict])
def list_workflow_nodes(
    excluded_app_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    배포된 워크플로우 노드 목록을 조회합니다. (재사용 가능한 모듈)
    """
    return DeploymentService.list_workflow_node_deployments(
        db, current_user.id, excluded_app_id=excluded_app_id
    )


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


@router.get("/public/{url_slug}/info")
def get_deployment_info_public(
    url_slug: str, response: Response, db: Session = Depends(get_db)
):
    """
    배포 정보 공개 조회 (웹 앱/임베딩용, 인증 불필요)

    공유 페이지에서 입력 폼을 동적으로 생성하기 위해
    input_schema와 output_schema를 조회합니다.

    CORS: 모든 출처 허용 (임베딩 위젯 지원)
    """
    from fastapi import HTTPException

    from apps.shared.db.models.app import App
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.shared.schemas.deployment import DeploymentInfoResponse

    # CORS 헤더 추가 (임베딩 위젯 지원)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"

    # 1. url_slug로 App 조회
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # 2. 활성 배포 조회
    if not app.active_deployment_id:
        raise HTTPException(
            status_code=404, detail="No active deployment found for this app"
        )

    deployment = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.id == app.active_deployment_id)
        .first()
    )

    if not deployment:
        raise HTTPException(status_code=404, detail="Active deployment not found")

    if not deployment.is_active:
        raise HTTPException(status_code=404, detail="Deployment is inactive")

    return DeploymentInfoResponse(
        url_slug=app.url_slug,
        version=deployment.version,
        description=deployment.description,
        type=deployment.type.value,
        input_schema=deployment.input_schema,
        output_schema=deployment.output_schema,
    )


@router.patch("/{deployment_id}/toggle", response_model=DeploymentResponse)
def toggle_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    배포의 is_active 상태를 토글합니다.
    """
    from apps.gateway.services.scheduler_service import get_scheduler_service

    scheduler = get_scheduler_service()
    return DeploymentService.toggle_deployment(db, deployment_id, scheduler)


@router.delete("/{deployment_id}")
def delete_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    배포를 삭제합니다.
    """
    from apps.gateway.services.scheduler_service import get_scheduler_service

    scheduler = get_scheduler_service()
    return DeploymentService.delete_deployment(db, deployment_id, scheduler)
