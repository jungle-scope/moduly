from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.workflow import WorkflowDraftRequest
from services.workflow_service import WorkflowService

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
