from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.workflow import WorkflowDraftRequest
from services.workflow_service import WorkflowService
from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


@router.post("/{workflow_id}/draft")
def sync_draft_workflow(
    workflow_id: str, request: WorkflowDraftRequest, db: Session = Depends(get_db)
):
    """
    프론트엔드로부터 워크플로우 초안 데이터를 받아 PostgreSQL에 저장합니다.

    Args:
        workflow_id: 워크플로우 ID (URL 경로에서 가져옴)
        request: 워크플로우 데이터 (노드, 엣지, 뷰포트)
        db: 데이터베이스 세션 (의존성 주입)
    """
    return WorkflowService.save_draft(db, workflow_id, request)


@router.get("/{workflow_id}/draft")
def get_draft_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회합니다.
    """
    return WorkflowService.get_draft(db, workflow_id)


@router.post("/{workflow_id}/execute")
def execute_workflow(
    workflow_id: str, user_input: dict = {}, db: Session = Depends(get_db)
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회하고, WorkflowEngine을 사용하여 실행합니다.
    """
    graph = WorkflowService.get_draft(db, workflow_id)
    if not graph:
        return {"error": f"Workflow '{workflow_id}' not found"}

    engine = WorkflowEngine(graph, user_input)
    print("user_input", user_input)

    return engine.execute()
