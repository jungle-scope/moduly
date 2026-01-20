"""Webhook 수신 및 캡처 엔드포인트"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from apps.shared.celery_app import celery_app
from apps.shared.db.models.app import App
from apps.shared.db.models.workflow_deployment import WorkflowDeployment
from apps.shared.db.session import get_db

import uuid
from datetime import datetime, timezone
from apps.shared.db.models.workflow_run import (
    WorkflowRun,
    RunStatus,
    RunTriggerMode,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# 캡처 세션용 메모리 저장소 (서버 메모리)
CAPTURE_SESSIONS: Dict[str, Dict[str, Any]] = {}


def verify_webhook_auth(request: Request, app: App) -> bool:
    """
    다양한 Webhook 인증 방식을 순차적으로 검증

    지원 방식:
    1. Query Parameter: ?token=xxx
    2. Authorization Header: Bearer xxx
    3. Custom Header: X-Webhook-Secret: xxx

    Args:
        request: FastAPI Request 객체
        app: App 모델 객체 (auth_secret 포함)

    Returns:
        True if authenticated, False otherwise
    """
    # 1. Query Parameter
    token = request.query_params.get("token")
    if token and token == app.auth_secret:
        return True

    # 2. Authorization Header (Bearer)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]  # "Bearer " 제거
        if token == app.auth_secret:
            return True

    # 3. Custom Header (X-Webhook-Secret)
    webhook_secret = request.headers.get("X-Webhook-Secret")
    if webhook_secret and webhook_secret == app.auth_secret:
        return True

    return False


def run_webhook_workflow(
    deployment_id: str, payload: Dict[str, Any], app_created_by: str, workflow_id: str, workflow_run_id: str
):
    """
    백그라운드에서 워크플로우를 Celery 태스크로 실행하는 함수

    Args:
        deployment_id: 배포 ID
        payload: Webhook Payload (JSON)
        app_created_by: 앱 생성자 ID
        workflow_id: 워크플로우 ID
        workflow_run_id: WorkflowRun ID (Gateway에서 미리 생성됨)
    """
    try:
        # execution_context 구성
        execution_context = {
            "user_id": app_created_by,
            "workflow_id": workflow_id,
            "workflow_run_id": workflow_run_id,
            "trigger_mode": "webhook",
            "deployment_id": deployment_id,
        }

        # Celery 태스크로 워크플로우 실행 위임 (비동기, 결과 대기 안 함)
        # 배포 그래프 데이터는 Celery Worker에서 조회
        celery_app.send_task(
            "workflow.execute_by_deployment",
            args=[deployment_id, payload, execution_context],
        )

    except Exception as e:
        logger.error(f"[Webhook Error] Failed to send Celery task: {str(e)}")
        logger.exception("Failed to send Celery task")


@router.post("/hooks/{url_slug}")
async def receive_webhook(
    url_slug: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Webhook 수신 엔드포인트

    - 캡처 모드: Payload를 메모리에 저장
    - 실행 모드: WorkflowEngine을 BackgroundTasks로 실행

    인증 방식:
    - Query Parameter: ?token=xxx
    - Authorization Header: Bearer xxx
    - Custom Header: X-Webhook-Secret: xxx
    """
    # 1. App 조회 (url_slug로)
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # 2. 인증 검증
    if not verify_webhook_auth(request, app):
        raise HTTPException(
            status_code=403,
            detail="Authentication failed. Provide token via query param (?token=xxx), Bearer header, or X-Webhook-Secret header.",
        )

    # 3. Payload 파싱
    payload = await request.json()

    # 4. 캡처 모드 확인
    if (
        url_slug in CAPTURE_SESSIONS
        and CAPTURE_SESSIONS[url_slug]["status"] == "waiting"
    ):
        # 캡처 모드: Payload 저장 후 종료
        CAPTURE_SESSIONS[url_slug]["payload"] = payload
        CAPTURE_SESSIONS[url_slug]["status"] = "captured"
        return {"status": "captured", "message": "Payload captured successfully"}

    # 5. Active Deployment 조회
    if not app.active_deployment_id:
        raise HTTPException(
            status_code=400,
            detail="No active deployment. Please deploy the workflow first.",
        )

    deployment = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.id == app.active_deployment_id)
        .first()
    )
    if not deployment:
        raise HTTPException(status_code=404, detail="Active deployment not found")

    # 6. WorkflowRun을 먼저 동기적으로 생성    
    run_id = uuid.uuid4()
    workflow_run = WorkflowRun(
        id=run_id,
        workflow_id=app.workflow_id,
        user_id=app.created_by,
        status=RunStatus.RUNNING,
        trigger_mode=RunTriggerMode.API,  # Webhook은 API 방식
        inputs=payload,
        started_at=datetime.now(timezone.utc),
    )
    db.add(workflow_run)
    db.commit()
    logger.info(f"[Webhook] WorkflowRun created synchronously: {run_id}")

    # 7. 실행 모드: Celery 태스크로 워크플로우 실행 위임
    background_tasks.add_task(
        run_webhook_workflow,
        str(deployment.id),
        payload,
        str(app.created_by),
        str(app.workflow_id) if app.workflow_id else None,
        str(run_id),
    )

    return {
        "status": "accepted",
        "message": "Webhook received, processing in background",
    }


@router.get("/hooks/{url_slug}/capture/start")
def start_capture(url_slug: str, db: Session = Depends(get_db)):
    """캡처 세션 시작"""
    # App 존재 확인
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # 캡처 세션 생성
    CAPTURE_SESSIONS[url_slug] = {"status": "waiting", "payload": None}
    return {"status": "waiting", "message": "Capture session started"}


@router.get("/hooks/{url_slug}/capture/status")
def get_capture_status(url_slug: str):
    """캡처 상태 조회"""
    if url_slug not in CAPTURE_SESSIONS:
        raise HTTPException(status_code=404, detail="No capture session found")

    session = CAPTURE_SESSIONS[url_slug]

    # 캡처 완료 시 자동 정리
    if session["status"] == "captured":
        payload = session["payload"]
        del CAPTURE_SESSIONS[url_slug]  # 메모리 정리
        return {"status": "captured", "payload": payload}

    return {"status": session["status"], "payload": None}
