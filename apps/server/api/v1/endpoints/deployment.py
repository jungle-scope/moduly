from typing import List

from fastapi import APIRouter, Depends, Response
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
    app_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 앱의 배포 이력을 조회합니다.
    """
    return DeploymentService.list_deployments(db, app_id, skip, limit)


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

    from db.models.workflow_deployment import WorkflowDeployment
    from schemas.deployment import DeploymentInfoResponse

    # CORS 헤더 추가 (임베딩 위젯 지원)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"

    # url_slug로 배포 조회
    deployment = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.url_slug == url_slug)
        .first()
    )

    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if not deployment.is_active:
        raise HTTPException(status_code=404, detail="Deployment is inactive")

    # 공개 정보만 반환 (auth_secret 제외)
    return DeploymentInfoResponse(
        url_slug=deployment.url_slug,
        version=deployment.version,
        description=deployment.description,
        type=deployment.type.value,
        input_schema=deployment.input_schema,
        output_schema=deployment.output_schema,
    )
