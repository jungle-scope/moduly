import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.app import App
from db.models.user import User
from db.models.workflow import Workflow
from db.session import get_db
from schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowDraftRequest,
    WorkflowResponse,
)
from services.workflow_service import WorkflowService
from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


@router.post("", response_model=WorkflowResponse)
def create_workflow(
    request: WorkflowCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    새 워크플로우 생성 (인증 필요)
    """
    workflow = WorkflowService.create_workflow(
        db, request, user_id=str(current_user.id)
    )

    return {
        "id": str(workflow.id),
        "app_id": workflow.app_id,
        "created_at": workflow.created_at.isoformat(),
        "updated_at": workflow.updated_at.isoformat(),
    }


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    워크플로우 메타데이터 조회 (app_id 포함)
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "id": str(workflow.id),
        "app_id": workflow.app_id,
        "created_at": workflow.created_at.isoformat(),
        "updated_at": workflow.updated_at.isoformat(),
    }


@router.get("/app/{app_id}", response_model=List[WorkflowResponse])
def list_workflows_by_app(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 App의 모든 워크플로우 조회
    """
    # App 권한 확인
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    if app.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 워크플로우 목록 조회
    workflows = db.query(Workflow).filter(Workflow.app_id == app_id).all()

    return [
        {
            "id": str(w.id),
            "app_id": w.app_id,
            "created_at": w.created_at.isoformat(),
            "updated_at": w.updated_at.isoformat(),
        }
        for w in workflows
    ]


@router.post("/{workflow_id}/draft")
def sync_draft_workflow(
    workflow_id: str,
    request: WorkflowDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    프론트엔드로부터 워크플로우 초안 데이터를 받아 PostgreSQL에 저장합니다. (인증 필요)

    Args:
        workflow_id: 워크플로우 ID (URL 경로에서 가져옴)
        request: 워크플로우 데이터 (노드, 엣지, 뷰포트)
        db: 데이터베이스 세션 (의존성 주입)
        current_user: 현재 로그인한 사용자
    """
    # 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if workflow and workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return WorkflowService.save_draft(
        db, workflow_id, request, user_id=str(current_user.id)
    )


@router.get("/{workflow_id}/draft")
def get_draft_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회합니다. (인증 필요)
    """
    # 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    return WorkflowService.get_draft(db, workflow_id)


@router.post("/{workflow_id}/execute")
def execute_workflow(
    workflow_id: str,
    user_input: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회하고, WorkflowEngine을 사용하여 실행합니다. (인증 필요)
    """
    # 1. 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2. 데이터 조회 및 실행
    try:
        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise HTTPException(
                status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
            )

        # WorkflowEngine 인스턴스 생성 및 초기화:
        # 1. 입력받은 graph(dict)를 NodeSchema/EdgeSchema 객체로 파싱 및 검증
        # 2. 엣지 정보를 바탕으로 노드 간의 실행 경로(Graph 구조) 빌드
        # 3. 각 노드 타입에 맞는 실제 실행 객체(Node Instance)를 미리 생성하여 메모리에 적재 (실행 준비 완료)
        engine = WorkflowEngine(
            graph, user_input, execution_context={"user_id": str(current_user.id)}
        )
        print("user_input", user_input)

        # 준비된 엔진을 실행 (시작 노드 탐색 -> Queue 기반 순차 실행 -> 결과 반환)
        return engine.execute()
    except ValueError as e:
        # 노드 검증 실패 등의 입력 오류
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        # 미지원 노드 등
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        # 그 외 서버 에러
        print(f"Workflow execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{workflow_id}/stream")
def stream_workflow(
    workflow_id: str,
    user_input: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    워크플로우를 실행하고 실행 과정을 SSE(Server-Sent Events)로 스트리밍합니다.
    클라이언트는 이 스트림을 통해 실시간으로 노드 실행 상태('running', 'success' 등)를 시각화할 수 있습니다.
    """

    # 1. 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2. 데이터 조회 및 엔진 초기화
    try:
        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise HTTPException(
                status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
            )

        engine = WorkflowEngine(
            graph, user_input, execution_context={"user_id": str(current_user.id)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 3. 제너레이터 함수 정의 (SSE 포맷팅)
    def event_generator():
        try:
            for event in engine.execute_stream():
                # SSE 포맷: "data: {json_content}\n\n"
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            # 스트리밍 도중 에러 발생 시 에러 이벤트 전송
            error_event = {"type": "error", "data": {"message": str(e)}}
            yield f"data: {json.dumps(error_event)}\n\n"

    # 4. StreamingResponse 반환
    return StreamingResponse(event_generator(), media_type="text/event-stream")
