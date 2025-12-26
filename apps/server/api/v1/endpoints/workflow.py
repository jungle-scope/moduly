from fastapi import APIRouter

from schemas.workflow import WorkflowDraftRequest
from services.workflow_engine import WorkflowEngine
from services.workflow_service import WorkflowService

workflow_router = APIRouter()


@workflow_router.post("/draft")
def sync_draft_workflow(request: WorkflowDraftRequest):
    """
    프론트엔드로부터 워크플로우 초안 데이터를 받아 동기화(저장)합니다.
    """
    return WorkflowService.save_draft(request)


@workflow_router.post("/execute")
def execute_workflow(request: WorkflowDraftRequest):
    """
    워크플로우를 실제로 실행합니다.
    노드와 엣지를 받아서 전체 워크플로우를 순차적으로 처리합니다.
    """

    engine = WorkflowEngine(request.nodes, request.edges)
    return engine.execute()
