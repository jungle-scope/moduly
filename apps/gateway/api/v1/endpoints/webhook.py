import os
from typing import Any, Dict

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from shared.db.models.app import App
from shared.db.models.workflow_deployment import WorkflowDeployment
from shared.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter()

# 캡처 세션용 메모리 저장소 (서버 메모리)
CAPTURE_SESSIONS: Dict[str, Dict[str, Any]] = {}


async def run_webhook_workflow(
    deployment_id: str, url_slug: str, payload: Dict[str, Any], db: Session
):
    """
    백그라운드에서 워크플로우를 실행하는 함수 (Workflow Engine으로 프록시)

    Args:
        deployment_id: 배포 ID
        url_slug: 앱 URL Slug
        payload: Webhook Payload (JSON)
        db: DB 세션 (프록시에서는 사용하지 않지만 시그니처 유지)
    """
    try:
        engine_url = os.getenv("WORKFLOW_ENGINE_URL", "http://localhost:8001")

        # Engine의 run_deployed_workflow API 호출을 위한 payload
        # Engine의 execute.py > wrappers 참조
        # execute.py/run_deployed_workflow는 ExecuteRequest를 받음

        # We need user_id. For webhook, who is the user?
        # Usually the owner of the app. The caller of this function should provide it?
        # But receive_webhook doesn't check owner.
        # Let's query deployment to find owner (created_by) ?
        # Or just pass a system user ID if available.
        # Let's query the deployment here to get created_by, or pass it from caller.

        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            print(f"[Webhook Error] Deployment {deployment_id} not found")
            return

        # App owner might be better, but deployment.created_by is also fine.
        user_id = str(deployment.created_by)

        request_payload = {
            "user_id": user_id,
            "user_input": payload,
            "is_deployed": True,
            "deployment_id": deployment_id,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{engine_url}/internal/run/{url_slug}",
                json=request_payload,
                timeout=60.0,
            )

            if resp.status_code >= 400:
                print(f"[Webhook Error] Engine failed: {resp.text}")
            else:
                print(f"[Webhook Success] Workflow executed via Engine: {resp.json()}")

    except Exception as e:
        print(f"[Webhook Error] Failed to proxy workflow: {str(e)}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


@router.post("/hooks/{url_slug}")
async def receive_webhook(
    url_slug: str,
    request: Request,
    background_tasks: BackgroundTasks,
    token: str = None,
    db: Session = Depends(get_db),
):
    """
    Webhook 수신 엔드포인트

    - 캡처 모드: Payload를 메모리에 저장
    - 실행 모드: WorkflowEngine을 BackgroundTasks로 실행
    """
    # 1. App 조회 (url_slug로)
    app = db.query(App).filter(App.url_slug == url_slug).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    # 2. Token 검증 (보안) - app.auth_secret 사용
    if not token or token != app.auth_secret:
        raise HTTPException(status_code=403, detail="Invalid token")

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
    from shared.db.session import SessionLocal

    bg_db = SessionLocal()
    # Pass url_slug to the background task
    background_tasks.add_task(
        run_webhook_workflow, str(deployment.id), url_slug, payload, bg_db
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
