from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.user import User
from db.models.workflow import Workflow
from db.session import get_db
from schemas.workflow import WorkflowDraftRequest
from services.workflow_service import WorkflowService
from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


@router.post("/{workflow_id}/draft")
def sync_draft_workflow(
    workflow_id: str,
    request: WorkflowDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    프론트엔드로부터 워크플로우 초안 데이터를 받아 PostgreSQL에 저장합니다. (인증 필요)

    Args:
        workflow_id: 워크플로우 ID (URL 경로에서 가져옴)
        request: 워크플로우 데이터 (노드, 엣지, 뷰포트)
        db: 데이터베이스 세션 (의존성 주입)
        current_user: 현재 로그인한 사용자
    """
    # 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if workflow and workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return WorkflowService.save_draft(
        db, workflow_id, request, user_id=str(current_user.id)
    )


@router.get("/{workflow_id}/draft")
def get_draft_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회합니다. (인증 필요)
    """
    # 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return WorkflowService.get_draft(db, workflow_id)


@router.post("/{workflow_id}/execute")
def execute_workflow(
    workflow_id: str,
    user_input: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회하고, WorkflowEngine을 사용하여 실행합니다. (인증 필요)
    """
    # 1. 권한 확인 (본인의 보안 로직 유지)
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2. 데이터 조회 및 실행 (develop의 최신 구조 반영)
    graph = WorkflowService.get_draft(db, workflow_id)
    if not graph:
        # HTTPException으로 통일하는 것이 더 좋으므로 404를 던집니다.
        raise HTTPException(
            status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
        )

    # develop에서 추가된 user_input을 사용하여 엔진 실행
    engine = WorkflowEngine(graph, user_input)
    print("user_input", user_input)

    return engine.execute()
