"""
Workflow-Engine Celery 태스크 정의
워크플로우 실행을 비동기적으로 처리
"""

import asyncio
import uuid
from typing import Any, Dict

from apps.shared.celery_app import celery_app
from apps.shared.db.session import SessionLocal


@celery_app.task(name="workflow.execute", bind=True, max_retries=3)
def execute_workflow(
    self,
    graph: Dict[str, Any],
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
    is_deployed: bool = False,
):
    """
    워크플로우 비동기 실행

    Args:
        graph: 워크플로우 그래프 데이터 {"nodes": [...], "edges": [...]}
        user_input: 사용자 입력
        execution_context: 실행 컨텍스트 (user_id, workflow_id 등)
        is_deployed: 배포 모드 여부 (기본값: False)

    Returns:
        워크플로우 실행 결과
    """
    from workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None
    # [FIX] 명시적 이벤트 루프 관리 (메모리 누수 방지)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # [NEW] DB Knowledge Base 동기화 (Sync Hook)
        try:
            user_id_str = execution_context.get("user_id")
            if user_id_str:
                from apps.workflow_engine.services.sync_service import SyncService

                user_id = uuid.UUID(user_id_str)
                syncer = SyncService(db=session, user_id=user_id)
                syncer.sync_knowledge_bases(graph)
        except Exception as e:
            print(f"[워크플로우엔진] 동기화 훅 실패: {e}")

        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=is_deployed,
            db=session,
        )

        # 워크플로우 실행 (async → sync 변환)
        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_workflow 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        # [FIX] 명시적 리소스 정리 (메모리 누수 방지)
        if engine is not None:
            engine.cleanup()
        session.close()
        loop.close()
        asyncio.set_event_loop(None)


@celery_app.task(name="workflow.execute_deployed", bind=True, max_retries=3)
def execute_deployed_workflow(
    self,
    workflow_id: str,
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
):
    """
    배포된 워크플로우 실행

    Args:
        workflow_id: 배포된 워크플로우 ID
        user_input: 사용자 입력
        execution_context: 실행 컨텍스트

    Returns:
        워크플로우 실행 결과
    """
    from workflow.core.workflow_engine import WorkflowEngine

    from apps.shared.db.models.workflow_deployment import WorkflowDeployment

    session = SessionLocal()
    engine = None
    # [FIX] 명시적 이벤트 루프 관리 (메모리 누수 방지)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # 배포된 워크플로우 조회
        deployment = (
            session.query(WorkflowDeployment)
            .filter(WorkflowDeployment.workflow_id == workflow_id)
            .filter(WorkflowDeployment.is_active.is_(True))
            .first()
        )

        if not deployment:
            raise ValueError(f"배포된 워크플로우를 찾을 수 없습니다: {workflow_id}")

        # 저장된 그래프 데이터로 엔진 생성
        graph = deployment.graph_data

        # execution_context에 workflow_id 추가
        execution_context["workflow_id"] = workflow_id

        # [NEW] DB Knowledge Base 동기화 (Sync Hook)
        try:
            user_id_str = execution_context.get("user_id")
            if user_id_str:
                from apps.workflow_engine.services.sync_service import SyncService

                user_id = uuid.UUID(user_id_str)
                syncer = SyncService(db=session, user_id=user_id)
                syncer.sync_knowledge_bases(graph)
        except Exception as e:
            print(f"[워크플로우엔진] 동기화 훅 실패: {e}")

        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=True,
            db=session,
        )

        # 워크플로우 실행 (async → sync 변환)
        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_deployed_workflow 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        # [FIX] 명시적 리소스 정리 (메모리 누수 방지)
        if engine is not None:
            engine.cleanup()
        session.close()
        loop.close()
        asyncio.set_event_loop(None)


@celery_app.task(name="workflow.execute_by_deployment", bind=True, max_retries=3)
def execute_by_deployment(
    self,
    deployment_id: str,
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
):
    """
    배포 ID를 기반으로 워크플로우 실행 (Webhook 등에서 사용)

    Args:
        deployment_id: 배포 ID
        user_input: 사용자 입력
        execution_context: 실행 컨텍스트

    Returns:
        워크플로우 실행 결과
    """
    from workflow.core.workflow_engine import WorkflowEngine

    from apps.shared.db.models.workflow_deployment import WorkflowDeployment

    session = SessionLocal()
    engine = None
    # [FIX] 명시적 이벤트 루프 관리 (메모리 누수 방지)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # 배포 정보 조회
        deployment = (
            session.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )

        if not deployment:
            raise ValueError(f"배포를 찾을 수 없습니다: {deployment_id}")

        if not deployment.graph_snapshot:
            raise ValueError(f"배포 그래프 데이터가 없습니다: {deployment_id}")

        # [NEW] DB Knowledge Base 동기화 (Sync Hook)
        try:
            user_id_str = execution_context.get("user_id")
            if user_id_str:
                from apps.workflow_engine.services.sync_service import SyncService

                user_id = uuid.UUID(user_id_str)
                syncer = SyncService(db=session, user_id=user_id)
                syncer.sync_knowledge_bases(deployment.graph_snapshot)
        except Exception as e:
            print(f"[워크플로우엔진] 동기화 훅 실패: {e}")

        engine = WorkflowEngine(
            graph=deployment.graph_snapshot,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=True,
            db=session,
        )

        # 워크플로우 실행 (async → sync 변환)
        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_by_deployment 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        # [FIX] 명시적 리소스 정리 (메모리 누수 방지)
        if engine is not None:
            engine.cleanup()
        session.close()
        loop.close()
        asyncio.set_event_loop(None)


@celery_app.task(name="workflow.stream", bind=True, max_retries=3)
def stream_workflow(
    self,
    graph: Dict[str, Any],
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
    external_run_id: str,
):
    """
    워크플로우 스트리밍 실행 (외부에서 run_id 전달)

    Gateway에서 미리 생성한 run_id를 사용하여 Redis Pub/Sub으로 이벤트 발행.
    Gateway는 해당 채널을 구독하여 SSE로 클라이언트에 전달.

    Args:
        graph: 워크플로우 그래프 데이터
        user_input: 사용자 입력
        execution_context: 실행 컨텍스트
        external_run_id: 외부에서 전달받은 run_id (Gateway에서 생성)

    Returns:
        워크플로우 실행 결과
    """
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None
    # [FIX] 명시적 이벤트 루프 관리 (메모리 누수 방지)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # 외부 run_id를 execution_context에 주입
        execution_context["workflow_run_id"] = external_run_id

        # [NEW] DB Knowledge Base 동기화 (Sync Hook)
        try:
            user_id_str = execution_context.get("user_id")
            if user_id_str:
                from apps.workflow_engine.services.sync_service import SyncService

                user_id = uuid.UUID(user_id_str)
                syncer = SyncService(db=session, user_id=user_id)
                syncer.sync_knowledge_bases(graph)
        except Exception as e:
            print(f"[워크플로우엔진] 동기화 훅 실패: {e}")

        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=False,
            db=session,
        )

        # 스트리밍 모드로 실행 (execute_stream 사용)
        # 이벤트는 workflow_engine 내부에서 Redis Pub/Sub으로 발행됨
        async def run_stream():
            final_result = {}
            async for event in engine.execute_stream():
                if event.get("type") == "workflow_finish":
                    final_result = event.get("data", {})
                elif event.get("type") == "error":
                    raise ValueError(
                        event.get("data", {}).get("message", "Unknown error")
                    )
            return final_result

        result = loop.run_until_complete(run_stream())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] stream_workflow 실패: {e}")
        # 에러 이벤트도 Pub/Sub으로 발행
        from apps.shared.pubsub import publish_workflow_event

        publish_workflow_event(external_run_id, "error", {"message": str(e)})
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        # [FIX] 명시적 리소스 정리 (메모리 누수 방지)
        if engine is not None:
            engine.cleanup()
        session.close()
        loop.close()
        asyncio.set_event_loop(None)
