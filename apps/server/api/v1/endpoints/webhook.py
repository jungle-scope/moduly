"""Webhook 수신 및 캡처 엔드포인트"""

from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow_deployment import WorkflowDeployment
from db.session import get_db
from workflow.core.workflow_engine import WorkflowEngine

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


async def run_webhook_workflow(
    deployment_id: str, payload: Dict[str, Any], db: Session
):
    """
    백그라운드에서 워크플로우를 실행하는 함수

    Args:
        deployment_id: 배포 ID
        payload: Webhook Payload (JSON)
        db: DB 세션
    """
    try:
        # 배포 정보 조회
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )

        if not deployment or not deployment.graph_snapshot:
            print(f"[Webhook Error] Deployment {deployment_id} not found")
            return

        # 엔진 실행
        engine = WorkflowEngine(
            graph=deployment.graph_snapshot,
            user_input=payload,  # Webhook Payload를 user_input으로 전달
            is_deployed=True,
        )

        result = await engine.execute()
        print(f"[Webhook Success] Workflow executed: {result}")

    except Exception as e:
        print(f"[Webhook Error] Failed to execute workflow: {str(e)}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


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

    # 6. 실행 모드: 엔진 실행 (BackgroundTasks)
    from db.session import SessionLocal

    bg_db = SessionLocal()
    background_tasks.add_task(run_webhook_workflow, str(deployment.id), payload, bg_db)

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
