import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from services.log_service import LogService
from shared.db.session import get_db
from shared.schemas.log import WorkflowNodeRunSchema, WorkflowRunSchema
from sqlalchemy.orm import Session

router = APIRouter()

# === Request Schemas (Inline for simplicity or move to schemas/) ===
from datetime import datetime

from pydantic import BaseModel


class CreateRunLogRequest(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    trigger_mode: str
    inputs: Optional[Dict[str, Any]] = None
    started_at: datetime
    workflow_version: Optional[int] = None
    deployment_id: Optional[uuid.UUID] = None


class UpdateRunLogRequest(BaseModel):
    status: Optional[str] = None
    outputs: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    finished_at: Optional[datetime] = None
    total_tokens: Optional[int] = None
    total_cost: Optional[float] = None


class CreateNodeLogRequest(BaseModel):
    id: Optional[uuid.UUID] = None
    node_id: str
    node_type: str
    status: str
    inputs: Optional[Dict[str, Any]] = None
    started_at: datetime


class UpdateNodeLogRequest(BaseModel):
    status: Optional[str] = None
    outputs: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    finished_at: Optional[datetime] = None


# === API Endpoints ===


@router.post("/runs", response_model=WorkflowRunSchema)
def create_run_log(request: CreateRunLogRequest, db: Session = Depends(get_db)):
    """워크플로우 실행 로그 생성"""
    return LogService.create_run_log(db, request.model_dump())


@router.patch("/runs/{run_id}", response_model=WorkflowRunSchema)
def update_run_log(
    run_id: uuid.UUID, request: UpdateRunLogRequest, db: Session = Depends(get_db)
):
    """워크플로우 실행 로그 업데이트 (종료 등)"""
    run = LogService.update_run_log(db, run_id, request.model_dump(exclude_unset=True))
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs/{run_id}/nodes", response_model=WorkflowNodeRunSchema)
def create_node_log(
    run_id: uuid.UUID, request: CreateNodeLogRequest, db: Session = Depends(get_db)
):
    """노드 실행 로그 생성"""
    data = request.model_dump()
    return LogService.create_node_log(db, run_id, data)


@router.patch(
    "/runs/{run_id}/nodes/{node_id_or_uuid}", response_model=WorkflowNodeRunSchema
)
def update_node_log(
    run_id: uuid.UUID,
    node_id_or_uuid: str,  # UUID via path, but could be node_id if we search differently
    request: UpdateNodeLogRequest,
    db: Session = Depends(get_db),
):
    """노드 실행 로그 업데이트"""
    # Try parsing as UUID
    try:
        node_run_uuid = uuid.UUID(node_id_or_uuid)
        node_run = LogService.update_node_log(
            db, node_run_uuid, request.model_dump(exclude_unset=True)
        )
    except ValueError:
        # If not UUID, assume it's node_id string (e.g. "llm-node-1")
        # In this case we need run_id to identify the node run
        node_run = LogService.update_node_log_by_node_id(
            db, run_id, node_id_or_uuid, request.model_dump(exclude_unset=True)
        )

    if not node_run:
        raise HTTPException(status_code=404, detail="Node run not found")
    return node_run


@router.get("/workflows/{workflow_id}/runs", response_model=List[WorkflowRunSchema])
def get_workflow_runs(
    workflow_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """해당 워크플로우의 실행 이력 조회"""
    return LogService.get_workflow_runs(db, workflow_id, skip, limit)
