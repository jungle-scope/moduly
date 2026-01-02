import json
import os
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

from auth.dependencies import get_current_user
from db.models.app import App
from db.models.user import User
from db.models.workflow import Workflow
# [NEW] 로깅 모델 및 스키마
from db.models.workflow_run import WorkflowRun
from schemas.log import WorkflowRunSchema, WorkflowRunListResponse
from db.session import get_db
from schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowDraftRequest,
    WorkflowResponse,
)
from services.workflow_service import WorkflowService
from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


# [NEW] 로그 조회 API
@router.get("/{workflow_id}/runs", response_model=WorkflowRunListResponse)
def get_workflow_runs(
    workflow_id: str,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 워크플로우의 실행 이력 조회
    """
    skip = (page - 1) * limit
    
    # 워크플로우 접근 권한 체크 (간단히 소유자만)
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # TODO: 권한 체크 로직 강화 필요 (협업 기능 등)
    # if workflow.created_by != str(current_user.id):
    #     raise HTTPException(status_code=403, detail="Not authorized")

    total = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == workflow_id).count()
    runs = (
        db.query(WorkflowRun)
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"total": total, "items": runs}


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
        # execution_context에 'db' 세션을 주입하는 이유:
        # WorkflowNode(모듈)가 실행될 때 대상 워크플로우의 그래프 데이터를 DB에서 로드해야 하기 때문입니다.
        # 3. 각 노드 타입에 맞는 실제 실행 객체(Node Instance)를 미리 생성하여 메모리에 적재 (실행 준비 완료)
        engine = WorkflowEngine(
            graph, user_input, execution_context={"user_id": str(current_user.id), "workflow_id": workflow_id}, db=db
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
async def stream_workflow(
    workflow_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    워크플로우를 실행하고 실행 과정을 SSE(Server-Sent Events)로 스트리밍합니다.

    multipart/form-data 지원:
    - inputs: JSON 문자열 (일반 입력값)
    - file_변수명: 업로드된 파일들
    """

    # 1. 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2. Request에서 FormData 파싱
    content_type = request.headers.get("content-type", "")
    user_input = {}

    if "multipart/form-data" in content_type:
        # FormData 파싱
        form = await request.form()

        # inputs 필드에서 JSON 파싱
        inputs_str = form.get("inputs", "{}")
        try:
            user_input = json.loads(inputs_str) if isinstance(inputs_str, str) else {}
        except json.JSONDecodeError:
            user_input = {}

        # 파일 필드 처리
        upload_dir = "uploads/temp"
        os.makedirs(upload_dir, exist_ok=True)

        for field_name, field_value in form.items():
            # file_로 시작하는 필드가 파일
            if field_name.startswith("file_") and hasattr(field_value, "filename"):
                file = field_value

                if file and file.filename:
                    # file_변수명에서 변수명 추출
                    var_name = field_name[5:]  # "file_" 제거

                    # 고유 파일명 생성
                    unique_filename = f"{workflow_id}_{uuid4().hex[:8]}_{file.filename}"
                    file_path = os.path.join(upload_dir, unique_filename)

                    # 파일 저장
                    with open(file_path, "wb") as buffer:
                        content = await file.read()
                        buffer.write(content)

                    user_input[var_name] = file_path
                    print(f"[DEBUG] 파일 저장: {var_name} -> {file_path}")
    else:
        # JSON 방식 (기존)
        try:
            body = await request.json()
            user_input = body if isinstance(body, dict) else {}
        except:
            user_input = {}

    # 3. 데이터 조회 및 엔진 초기화
    try:
        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise HTTPException(
                status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
            )

        engine = WorkflowEngine(
            graph, 
            user_input, 
            execution_context={"user_id": str(current_user.id), "workflow_id": workflow_id}, 
            db=db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 4. 제너레이터 함수 정의 (SSE 포맷팅)
    def event_generator():
        try:
            for event in engine.execute_stream():
                # SSE 포맷: "data: {json_content}\n\n"
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            # 스트리밍 도중 에러 발생 시 에러 이벤트 전송
            error_event = {"type": "error", "data": {"message": str(e)}}
            yield f"data: {json.dumps(error_event)}\n\n"

    # 5. StreamingResponse 반환
    return StreamingResponse(event_generator(), media_type="text/event-stream")
