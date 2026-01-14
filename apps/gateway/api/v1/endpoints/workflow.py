import json
from typing import List

from apps.shared.celery_app import celery_app
from apps.shared.db.models.app import App
from apps.shared.db.models.user import User
from apps.shared.db.models.workflow import Workflow

# [NEW] 로깅 모델 및 스키마
from apps.shared.db.models.workflow_run import NodeRunStatus, RunStatus, WorkflowRun
from apps.shared.db.session import get_db
from apps.shared.schemas.log import (
    DashboardStatsResponse,
    WorkflowRunListResponse,
    WorkflowRunSchema,
)
from apps.shared.schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowDraftRequest,
    WorkflowResponse,
)
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# from sqlalchemy.orm import Session, noload, selectinload
from starlette.requests import Request

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.workflow_service import WorkflowService

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

    # total = (
    #     db.query(func.count(WorkflowRun.id))
    #     .filter(WorkflowRun.workflow_id == workflow_id)
    #     .scalar()
    #     or 0
    # )

    total = db.query(WorkflowRun).filter(WorkflowRun.workflow_id == workflow_id).count()

    runs = (
        db.query(WorkflowRun)
        # .options(noload(WorkflowRun.node_runs))
        .filter(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"total": total, "items": runs}


@router.get("/{workflow_id}/runs/{run_id}", response_model=WorkflowRunSchema)
def get_workflow_run_detail(
    workflow_id: str,
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 워크플로우 실행 이력 상세 조회
    """
    # 워크플로우 접근 권한 체크
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    run = (
        db.query(WorkflowRun)
        # .options(selectinload(WorkflowRun.node_runs))
        .filter(WorkflowRun.id == run_id, WorkflowRun.workflow_id == workflow_id)
        .first()
    )

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return run


# [NEW] 모니터링 대시보드 통계 API
from datetime import datetime, timedelta

from sqlalchemy import Date, cast, func


@router.get("/{workflow_id}/stats", response_model=DashboardStatsResponse)
def get_workflow_stats(
    workflow_id: str,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import traceback

    try:
        from apps.shared.db.models.workflow_run import WorkflowNodeRun, WorkflowRun
        from apps.shared.schemas.log import (
            DailyRunStat,
            DashboardStatsResponse,
            FailureStat,
            RecentFailure,
            RunCostStat,
            StatsSummary,
        )

        # 1. 권한 체크
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # 기간 필터 (기본 30일)
        cutoff_date = datetime.now() - timedelta(days=days)

        base_query = db.query(WorkflowRun).filter(
            WorkflowRun.workflow_id == workflow_id,
            WorkflowRun.started_at >= cutoff_date,
        )

        # === 1. Summary Stats ===
        total_runs = base_query.count()
        success_count = base_query.filter(
            WorkflowRun.status == RunStatus.SUCCESS
        ).count()

        # Avg Duration
        avg_duration = (
            db.query(func.avg(WorkflowRun.duration))
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.started_at >= cutoff_date,
                WorkflowRun.duration.isnot(None),
            )
            .scalar()
            or 0.0
        )

        # Total Cost & Tokens
        total_cost_res = (
            db.query(
                func.sum(WorkflowRun.total_cost), func.sum(WorkflowRun.total_tokens)
            )
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.started_at >= cutoff_date,
            )
            .first()
        )

        total_cost = float(total_cost_res[0] or 0.0)
        total_tokens = int(total_cost_res[1] or 0)

        summary = StatsSummary(
            totalRuns=total_runs,
            successRate=round((success_count / total_runs * 100), 1)
            if total_runs > 0
            else 0.0,
            avgDuration=round(avg_duration, 2),
            totalCost=round(total_cost, 8),
            avgTokenPerRun=round(total_tokens / total_runs, 1)
            if total_runs > 0
            else 0.0,
            avgCostPerRun=round(total_cost / total_runs, 8) if total_runs > 0 else 0.0,
        )

        # === 2. Runs Over Time (Extended) ===
        runs_over_time = []
        daily_stats = (
            db.query(
                cast(WorkflowRun.started_at, Date).label("date"),
                func.count(WorkflowRun.id),
                func.sum(WorkflowRun.total_cost),
                func.sum(WorkflowRun.total_tokens),
            )
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.started_at >= cutoff_date,
            )
            .group_by(cast(WorkflowRun.started_at, Date))
            .order_by(cast(WorkflowRun.started_at, Date))
            .all()
        )

        for row in daily_stats:
            runs_over_time.append(
                DailyRunStat(
                    date=str(row[0]),
                    count=row[1],
                    total_cost=float(row[2] or 0.0),
                    total_tokens=int(row[3] or 0),
                )
            )

        # === 3. Cost Analysis (Min/Max Runs) ===
        # Top 3 Min Cost (Success only, Cost > 0 to avoid boring zeros if wanted, but user asked for min cost. 0 is valid min.)
        # Let's just do Success runs.
        min_cost_runs = []
        min_runs_query = (
            db.query(WorkflowRun)
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.status == RunStatus.SUCCESS,
                WorkflowRun.started_at >= cutoff_date,
                # WorkflowRun.total_cost > 0 # Optional
            )
            .order_by(WorkflowRun.total_cost.asc())
            .limit(3)
            .all()
        )

        for run in min_runs_query:
            min_cost_runs.append(
                RunCostStat(
                    run_id=run.id,
                    started_at=run.started_at,
                    total_tokens=run.total_tokens or 0,
                    total_cost=run.total_cost or 0.0,
                )
            )

        # Top 3 Max Cost
        max_cost_runs = []
        max_runs_query = (
            db.query(WorkflowRun)
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.status == RunStatus.SUCCESS,
                WorkflowRun.started_at >= cutoff_date,
            )
            .order_by(WorkflowRun.total_cost.desc())
            .limit(3)
            .all()
        )

        for run in max_runs_query:
            max_cost_runs.append(
                RunCostStat(
                    run_id=run.id,
                    started_at=run.started_at,
                    total_tokens=run.total_tokens or 0,
                    total_cost=run.total_cost or 0.0,
                )
            )

        # === 4. Failure Analysis ===
        failure_analysis = []
        failed_nodes = (
            db.query(
                WorkflowNodeRun.node_id,
                WorkflowNodeRun.node_type,
                WorkflowNodeRun.error_message,
                func.count(WorkflowNodeRun.id),
            )
            .join(WorkflowRun)
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowNodeRun.status == NodeRunStatus.FAILED,
                WorkflowRun.started_at >= cutoff_date,
            )
            .group_by(
                WorkflowNodeRun.node_id,
                WorkflowNodeRun.node_type,
                WorkflowNodeRun.error_message,
            )
            .order_by(func.count(WorkflowNodeRun.id).desc())
            .limit(5)
            .all()
        )

        for row in failed_nodes:
            failure_analysis.append(
                FailureStat(
                    node_id=row[0],
                    node_name=f"{row[1]} ({row[0]})",
                    count=row[3],
                    reason=str(row[2])[:50] + "..." if row[2] else "Unknown Error",
                    rate="-",
                )
            )

        # === 5. Recent Failures ===
        recent_failures = []
        failed_runs = (
            db.query(WorkflowRun)
            .filter(
                WorkflowRun.workflow_id == workflow_id,
                WorkflowRun.status == RunStatus.FAILED,
            )
            .order_by(WorkflowRun.started_at.desc())
            .limit(5)
            .all()
        )

        for run in failed_runs:
            failed_node = next(
                (n for n in run.node_runs if n.status == NodeRunStatus.FAILED),
                None,
            )
            recent_failures.append(
                RecentFailure(
                    run_id=str(run.id),
                    failed_at=str(run.started_at),
                    node_id=failed_node.node_id if failed_node else "Unknown",
                    error_message=run.error_message
                    or (failed_node.error_message if failed_node else "Unknown error"),
                )
            )

        return DashboardStatsResponse(
            summary=summary,
            runsOverTime=runs_over_time,
            minCostRuns=min_cost_runs,
            maxCostRuns=max_cost_runs,
            failureAnalysis=failure_analysis,
            recentFailures=recent_failures,
        )
    except Exception as e:
        print(f"[ERROR] Stats API Failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=WorkflowResponse)
def create_workflow(
    request: WorkflowCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    새 워크플로우 생성 (인증 필요)
    """
    workflow = WorkflowService.create_workflow(db, request, user_id=current_user.id)

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

    if workflow.created_by != current_user.id:
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

    if app.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # 워크플로우 목록 조회
    workflows = db.query(Workflow).filter(Workflow.app_id == app_id).all()

    return [
        {
            "id": str(w.id),
            "app_id": str(w.app_id),
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

    if workflow and workflow.created_by != current_user.id:
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

    if workflow.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return WorkflowService.get_draft(db, workflow_id)


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    user_input: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PostgreSQL에서 워크플로우 초안 데이터를 조회하고, Celery 태스크로 실행합니다. (인증 필요)
    """
    # 1. 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    memory_mode_enabled = False
    if isinstance(user_input, dict):
        # 프론트 토글 상태가 실행 입력에 섞여 올 수 있으므로 분리해서 컨텍스트에만 전달
        memory_mode_enabled = bool(user_input.pop("memory_mode", False))

    # 2. 데이터 조회 및 Celery 태스크 호출
    try:
        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise HTTPException(
                status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
            )

        # execution_context 구성
        execution_context = {
            "user_id": str(current_user.id),
            "workflow_id": workflow_id,
            "memory_mode": memory_mode_enabled,
        }

        # Celery 태스크 호출 (workflow.execute)
        task = celery_app.send_task(
            "workflow.execute",
            args=[graph, user_input, execution_context],
            kwargs={"is_deployed": False},
        )

        # 결과 대기 (타임아웃 10분)
        result = task.get(timeout=600)

        if result.get("status") == "success":
            return result.get("result", {})
        else:
            raise HTTPException(status_code=500, detail="Workflow execution failed")

    except celery_app.backend.TimeoutError:
        raise HTTPException(status_code=504, detail="Workflow execution timed out")
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

    memory_mode_enabled = False
    # 1. 권한 확인
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if workflow.created_by != current_user.id:
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

        # 토글 값 분리 (문자열 true/false 허용)
        memory_mode_enabled = str(form.get("memory_mode", "")).lower() == "true"
    else:
        # JSON 방식 (기존)
        try:
            body = await request.json()
            user_input = body if isinstance(body, dict) else {}
            if isinstance(user_input, dict):
                memory_mode_enabled = bool(user_input.pop("memory_mode", False))
        except:
            user_input = {}

    # 3. 데이터 조회 및 엔진 초기화
    try:
        # 스트리밍 모드는 직접 WorkflowEngine 사용 (Celery 비동기 호출 불가)
        from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise HTTPException(
                status_code=404, detail=f"Workflow '{workflow_id}' draft not found"
            )

        engine = WorkflowEngine(
            graph,
            user_input,
            execution_context={
                "user_id": str(current_user.id),
                "workflow_id": workflow_id,
                "memory_mode": memory_mode_enabled,
            },
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 4. 제너레이터 함수 정의 (SSE 포맷팅)
    async def event_generator():
        try:
            async for event in engine.execute_stream():
                # SSE 포맷: "data: {json_content}\n\n"
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            # 스트리밍 도중 에러 발생 시 에러 이벤트 전송
            error_event = {"type": "error", "data": {"message": str(e)}}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # [FIX] 클라이언트 연결 끊김 등으로 제너레이터가 중단되어도 리소스 정리 보장
            engine.logger.shutdown()

    # 5. StreamingResponse 반환
    return StreamingResponse(event_generator(), media_type="text/event-stream")
