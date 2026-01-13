"""
워크플로우 실행 엔드포인트

핵심 기능:
- POST /run/{url_slug}: SSE 스트리밍 실행
- POST /run-async/{url_slug}: 비동기 실행 (태스크 ID 반환)
- GET /run-status/{run_id}: 실행 상태 조회
"""
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from apps.shared.db.session import get_db
from apps.shared.db.models.app import App
from apps.shared.db.models.workflow_deployment import WorkflowDeployment
from apps.shared.db.models.workflow_run import WorkflowRun
from apps.shared.celery_app.config import celery_app
from apps.shared.redis.pubsub import subscribe_events, get_channel_name

router = APIRouter()


def get_deployment_by_slug(db: Session, url_slug: str) -> WorkflowDeployment:
    """URL 슬러그로 활성 배포 조회"""
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app:
        raise HTTPException(status_code=404, detail="앱을 찾을 수 없습니다")
    
    if not app.active_deployment_id:
        raise HTTPException(status_code=404, detail="활성 배포가 없습니다")
    
    deployment = db.query(WorkflowDeployment).filter(
        WorkflowDeployment.id == app.active_deployment_id
    ).first()
    
    if not deployment:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    
    if not deployment.is_active:
        raise HTTPException(status_code=400, detail="배포가 비활성화 상태입니다")
    
    return deployment


@router.post("/run/{url_slug}")
async def run_workflow(
    url_slug: str,
    request_body: dict = Body(...),
    authorization: Optional[str] = Header(None),
    x_auth_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    배포된 워크플로우 실행 (SSE 스트리밍)
    
    1. Celery 태스크 발행
    2. Redis Pub/Sub 구독
    3. SSE로 이벤트 스트리밍
    """
    # 1. 배포 정보 조회
    deployment = get_deployment_by_slug(db, url_slug)
    app = db.query(App).filter(App.url_slug == url_slug).first()
    
    # 2. 인증 확인 (API 배포인 경우)
    # TODO: 인증 로직 구현
    
    # 3. 실행 ID 생성
    run_id = str(uuid.uuid4())
    
    # 4. 사용자 입력 추출
    user_input = request_body.get("inputs", request_body)
    
    # 5. Celery 태스크 발행
    celery_app.send_task(
        "workflow.execute",
        args=[
            run_id,
            str(app.workflow_id),
            deployment.graph_snapshot,
            user_input,
            {
                "user_id": str(app.created_by),  # TODO: 인증된 사용자 사용
                "deployment_id": str(deployment.id),
                "workflow_version": deployment.version,
                "is_deployed": True,
            }
        ],
        queue="workflow",
    )
    
    # 6. SSE 스트리밍 응답
    async def event_stream():
        channel = get_channel_name(run_id)
        async for event in subscribe_events(channel):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx 버퍼링 비활성화
        },
    )


@router.post("/run-public/{url_slug}")
async def run_workflow_public(
    url_slug: str,
    request_body: dict = Body(...),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """
    공개 워크플로우 실행 (위젯/웹앱용, 인증 불필요)
    
    CORS 헤더 자동 설정
    """
    # CORS 헤더 추가
    if response:
        response.headers["Access-Control-Allow-Origin"] = "*"
    
    # 배포 정보 조회
    deployment = get_deployment_by_slug(db, url_slug)
    app = db.query(App).filter(App.url_slug == url_slug).first()
    
    # 공개 배포 타입 확인
    if deployment.type.value not in ("webapp", "widget"):
        raise HTTPException(status_code=403, detail="공개 접근이 허용되지 않은 배포입니다")
    
    # 실행 ID 생성
    run_id = str(uuid.uuid4())
    user_input = request_body.get("inputs", request_body)
    
    # Celery 태스크 발행
    celery_app.send_task(
        "workflow.execute",
        args=[
            run_id,
            str(app.workflow_id),
            deployment.graph_snapshot,
            user_input,
            {
                "user_id": str(app.created_by),
                "deployment_id": str(deployment.id),
                "workflow_version": deployment.version,
                "is_deployed": True,
            }
        ],
        queue="workflow",
    )
    
    # SSE 스트리밍 응답
    async def event_stream():
        channel = get_channel_name(run_id)
        async for event in subscribe_events(channel):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/run-async/{url_slug}")
async def run_workflow_async(
    url_slug: str,
    request_body: dict = Body(...),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    비동기 워크플로우 실행 (태스크 ID 반환)
    
    스트리밍 불필요 시 사용
    """
    deployment = get_deployment_by_slug(db, url_slug)
    app = db.query(App).filter(App.url_slug == url_slug).first()
    
    run_id = str(uuid.uuid4())
    user_input = request_body.get("inputs", request_body)
    
    # 비동기 태스크 발행
    task = celery_app.send_task(
        "workflow.execute_async",
        args=[
            run_id,
            str(app.workflow_id),
            deployment.graph_snapshot,
            user_input,
            {
                "user_id": str(app.created_by),
                "deployment_id": str(deployment.id),
                "workflow_version": deployment.version,
                "is_deployed": True,
            }
        ],
        queue="workflow",
    )
    
    return {
        "run_id": run_id,
        "task_id": task.id,
        "status": "pending",
    }


@router.get("/run-status/{run_id}")
async def get_run_status(
    run_id: str,
    db: Session = Depends(get_db),
):
    """실행 상태 조회"""
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    
    if not run:
        return {"run_id": run_id, "status": "not_found"}
    
    return {
        "run_id": str(run.id),
        "status": run.status.value,
        "outputs": run.outputs,
        "error_message": run.error_message,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "duration": run.duration,
    }
