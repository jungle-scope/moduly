import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from api.deps import get_db
from db.models.user import User
from db.models.workflow import Workflow
from db.models.workflow_deployment import WorkflowDeployment
from schemas.deployment import DeploymentCreate, DeploymentResponse
from services.workflow_service import WorkflowService

router = APIRouter()


@router.post("/", response_model=DeploymentResponse)
def create_deployment(
    deployment_in: DeploymentCreate,
    db: Session = Depends(get_db),
    # [DEV] user 정보 없어서 개발 중 임시로 주석처리
    # current_user: User = Depends(get_current_user),
):
    """
    워크플로우를 배포합니다.
    1. 현재 워크플로우의 Draft 상태(Graph)를 DB에서 읽어옵니다.
    2. 버전 번호를 채번합니다 (Max + 1).
    3. 배포 이력을 저장합니다.
    """
    # 1. 워크플로우 존재 확인
    # TODO: 권한 체크 (내 워크플로우인지)
    workflow = (
        db.query(Workflow).filter(Workflow.id == deployment_in.workflow_id).first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # 2. Draft 데이터(Snapshop) 가져오기
    # 현재: DB의 현재 Draft 데이터 가져옴
    # TODO: API Body로 받은 데이터 (나중에 프론트에서 구현 시)
    graph_snapshot = deployment_in.graph_snapshot
    if not graph_snapshot:
        graph_snapshot = WorkflowService.get_draft(db, deployment_in.workflow_id)

    if not graph_snapshot:
        raise HTTPException(
            status_code=400,
            detail="Cannot deploy workflow without graph data. Please save the workflow first.",
        )

    # 3. 버전 번호 채번
    max_version = (
        db.query(func.max(WorkflowDeployment.version))
        .filter(WorkflowDeployment.workflow_id == deployment_in.workflow_id)
        .scalar()
    ) or 0
    new_version = max_version + 1

    # 4. API Key (auth_secret) 및 URL Slug 생성
    # 난수키를 자동 발급
    auth_secret = deployment_in.auth_secret
    if not auth_secret:
        auth_secret = f"sk-{secrets.token_hex(24)}"  # 예: sk-3af...

    url_slug = deployment_in.url_slug
    if not url_slug:
        # 슬러그 미지정 시 자동 생성: v{version}-{random_hex}
        url_slug = f"v{new_version}-{secrets.token_hex(4)}"

    # [DEV] 임시 유저 처리
    # 개발 중에는 로그인 없이 테스트하므로, DB에 첫 번째 유저를 찾거나 없으면 생성해서 할당함
    temp_user = db.query(User).first()
    if not temp_user:
        temp_user = User(
            email="test@moduly.app",
            name="Test User",
        )
        db.add(temp_user)
        db.commit()
        db.refresh(temp_user)

    # 5. 배포 모델 생성
    db_obj = WorkflowDeployment(
        workflow_id=deployment_in.workflow_id,
        version=new_version,
        type=deployment_in.type,
        url_slug=url_slug,
        auth_secret=auth_secret,
        graph_snapshot=graph_snapshot,
        config=deployment_in.config,
        description=deployment_in.description,
        # created_by=current_user.id,
        created_by=temp_user.id,  # current_user.id 대신 temp_user.id 사용
        is_active=deployment_in.is_active,
    )

    try:
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
    except Exception as e:
        db.rollback()
        # Unique Violation (Slug 중복 등) 처리
        raise HTTPException(status_code=400, detail=str(e))

    return db_obj


@router.get("/", response_model=List[DeploymentResponse])
def get_deployments(
    workflow_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    # [DEV] user 정보 없어서 개발 중 임시로 주석처리
    # current_user: User = Depends(get_current_user),
):
    """
    특정 워크플로우의 배포 이력을 조회합니다.
    """
    deployments = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.workflow_id == workflow_id)
        .order_by(desc(WorkflowDeployment.version))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return deployments


@router.get("/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    # [DEV] user 정보 없어서 개발 중 임시로 주석처리
    # current_user: User = Depends(get_current_user),
):
    """
    특정 배포 ID의 상세 정보를 조회합니다.
    """
    deployment = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.id == deployment_id)
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Optional: 권한 체크 (읽기 권한이 있는지)

    return deployment
