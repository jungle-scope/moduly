from fastapi import APIRouter
from schemas.workflow import WorkflowDraftRequest
from services.workflow_service import WorkflowService

router = APIRouter()

@router.post("/draft")
def sync_draft_workflow(request: WorkflowDraftRequest):
    """
    프론트엔드로부터 워크플로우 초안 데이터를 받아 동기화(저장)합니다.
    """
    return WorkflowService.save_draft(request)
