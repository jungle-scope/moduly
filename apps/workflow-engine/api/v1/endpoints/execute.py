"""
워크플로우 실행 내부 API 엔드포인트

Gateway 서비스를 통해서만 접근 가능합니다.
"""

import sys
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from shared.db.session import get_db
from sqlalchemy.orm import Session

print(f"[DEBUG] sys.path: {sys.path}")
import traceback

router = APIRouter()


class ExecuteRequest(BaseModel):
    """워크플로우 실행 요청"""

    user_id: str
    user_input: Dict[str, Any] = {}
    is_deployed: bool = False
    deployment_id: Optional[str] = None
    workflow_version: Optional[int] = None


class ExecuteResponse(BaseModel):
    """워크플로우 실행 응답"""

    run_id: str
    status: str
    outputs: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("/execute/{workflow_id}", response_model=ExecuteResponse)
async def execute_workflow(
    workflow_id: str, request: ExecuteRequest, db: Session = Depends(get_db)
):
    """
    워크플로우 동기 실행

    Gateway의 POST /api/v1/workflows/{id}/execute에서 프록시됩니다.
    """
    from engine_services.execution_service import ExecutionService

    try:
        result = await ExecutionService.execute(
            db=db,
            workflow_id=workflow_id,
            user_id=request.user_id,
            user_input=request.user_input,
            is_deployed=request.is_deployed,
            deployment_id=request.deployment_id,
            workflow_version=request.workflow_version,
        )
        return result
    except Exception as e:
        print(f"[ERROR] execute_workflow failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream/{workflow_id}")
async def stream_workflow(
    workflow_id: str, request: ExecuteRequest, db: Session = Depends(get_db)
):
    """
    워크플로우 SSE 스트리밍 실행

    Gateway의 POST /api/v1/workflows/{id}/stream에서 프록시됩니다.
    """
    from engine_services.execution_service import ExecutionService

    async def event_generator():
        async for event in ExecutionService.stream(
            db=db,
            workflow_id=workflow_id,
            user_id=request.user_id,
            user_input=request.user_input,
            is_deployed=request.is_deployed,
            deployment_id=request.deployment_id,
            workflow_version=request.workflow_version,
        ):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/run/{url_slug}", response_model=ExecuteResponse)
async def run_deployed_workflow(
    url_slug: str, request: ExecuteRequest, db: Session = Depends(get_db)
):
    """
    배포된 워크플로우 실행

    Gateway의 POST /api/v1/run/{url_slug}에서 프록시됩니다.
    """
    from engine_services.execution_service import ExecutionService

    try:
        result = await ExecutionService.run_deployed(
            db=db,
            url_slug=url_slug,
            user_id=request.user_id,
            user_input=request.user_input,
            deployment_id=request.deployment_id,
        )
        return result
    except Exception as e:
        print(f"[ERROR] run_deployed_workflow failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
