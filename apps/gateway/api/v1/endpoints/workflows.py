"""워크플로우 관리 엔드포인트"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.db.models.workflow import Workflow
from apps.shared.schemas.workflow import WorkflowDraftRequest, WorkflowResponse

router = APIRouter()


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
):
    """워크플로우 상세 조회"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="워크플로우를 찾을 수 없습니다")
    
    return {
        "id": str(workflow.id),
        "app_id": str(workflow.app_id),
        "graph": workflow.graph,
        "features": workflow.features,
        "env_variables": workflow.env_variables,
        "runtime_variables": workflow.runtime_variables,
        "created_at": workflow.created_at.isoformat(),
        "updated_at": workflow.updated_at.isoformat(),
    }


@router.put("/{workflow_id}/draft")
async def save_workflow_draft(
    workflow_id: UUID,
    request: WorkflowDraftRequest,
    db: Session = Depends(get_db),
):
    """워크플로우 드래프트 저장"""
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="워크플로우를 찾을 수 없습니다")
    
    # 그래프 업데이트
    workflow.graph = {
        "nodes": [node.model_dump() for node in request.nodes],
        "edges": [edge.model_dump() for edge in request.edges],
        "viewport": request.viewport.model_dump() if request.viewport else None,
    }
    
    if request.features:
        workflow.features = request.features
    if request.env_variables:
        workflow.env_variables = [v.model_dump() for v in request.env_variables]
    if request.runtime_variables:
        workflow.runtime_variables = [v.model_dump() for v in request.runtime_variables]
    
    db.commit()
    db.refresh(workflow)
    
    return {"message": "저장 완료", "workflow_id": str(workflow_id)}
