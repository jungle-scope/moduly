"""로그 조회 엔드포인트"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.db.models.workflow_run import WorkflowRun, WorkflowNodeRun
from apps.shared.schemas.log import (
    WorkflowRunSchema,
    WorkflowRunListResponse,
    DashboardStatsResponse,
)

router = APIRouter()


@router.get("/runs", response_model=WorkflowRunListResponse)
async def get_workflow_runs(
    workflow_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    워크플로우 실행 로그 목록 조회
    
    Args:
        workflow_id: 특정 워크플로우의 로그만 조회
        user_id: 특정 사용자의 로그만 조회
        status: 상태 필터 (running, success, failed)
        skip: 페이지네이션 오프셋
        limit: 페이지 크기
    """
    query = db.query(WorkflowRun)
    
    if workflow_id:
        query = query.filter(WorkflowRun.workflow_id == workflow_id)
    if user_id:
        query = query.filter(WorkflowRun.user_id == user_id)
    if status:
        query = query.filter(WorkflowRun.status == status)
    
    total = query.count()
    items = (
        query.order_by(WorkflowRun.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return WorkflowRunListResponse(total=total, items=items)


@router.get("/runs/{run_id}", response_model=WorkflowRunSchema)
async def get_workflow_run(
    run_id: UUID,
    db: Session = Depends(get_db),
):
    """
    특정 워크플로우 실행 로그 상세 조회
    
    노드별 실행 이력 포함
    """
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="실행 로그를 찾을 수 없습니다")
    
    return run


@router.get("/runs/{run_id}/nodes")
async def get_node_runs(
    run_id: UUID,
    db: Session = Depends(get_db),
):
    """
    특정 실행의 노드별 실행 로그 조회
    """
    node_runs = (
        db.query(WorkflowNodeRun)
        .filter(WorkflowNodeRun.workflow_run_id == run_id)
        .order_by(WorkflowNodeRun.started_at)
        .all()
    )
    
    return {"run_id": str(run_id), "nodes": node_runs}


@router.delete("/runs/{run_id}")
async def delete_workflow_run(
    run_id: UUID,
    db: Session = Depends(get_db),
):
    """
    워크플로우 실행 로그 삭제
    """
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="실행 로그를 찾을 수 없습니다")
    
    db.delete(run)
    db.commit()
    
    return {"message": "삭제 완료", "run_id": str(run_id)}
