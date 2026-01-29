"""
Workflow-Engine Celery 태스크 정의
워크플로우 실행을 비동기적으로 처리

[GEVENT FIX] gevent pool 환경에서 asyncio 호환성을 위해
asyncio.new_event_loop() 대신 asyncio.run() 사용
"""

import asyncio
import logging
import uuid
from typing import Any, Dict

from apps.shared.celery_app import celery_app
from apps.shared.db.session import SessionLocal
from apps.shared.pubsub import close_async_redis_client

logger = logging.getLogger(__name__)


def _run_async(coro):
    """
    [GEVENT FIX] gevent 환경에서 asyncio 코루틴을 안전하게 실행

    gevent의 monkey patching이 적용된 환경에서는
    asyncio.new_event_loop()가 다른 greenlet과 충돌할 수 있음.
    대신 현재 이벤트 루프를 재사용하거나 새로 생성.
    """
    try:
        # 이미 실행 중인 이벤트 루프가 있는지 확인
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # 실행 중인 루프가 없으면 새로 생성하여 실행
        loop = None

    if loop is not None and loop.is_running():
        # 이미 루프가 실행 중이면 nest_asyncio 패턴 사용
        # 또는 greenlet spawn으로 처리
        import gevent

        result = None
        exception = None

        def _run():
            nonlocal result, exception
            try:
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    result = new_loop.run_until_complete(coro)
                finally:
                    new_loop.close()
                    asyncio.set_event_loop(None)
            except Exception as e:
                exception = e

        g = gevent.spawn(_run)
        g.join()

        if exception:
            raise exception
        return result
    else:
        # 루프가 없으면 일반적인 방식으로 실행
        return asyncio.run(coro)


async def _cleanup_resources(engine):
    """리소스 정리를 위한 async 헬퍼"""
    try:
        await close_async_redis_client()
    except Exception as e:
        logger.warning(f"Redis client cleanup warning: {e}")


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
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None
    sync_result = {}

    async def _execute():
        nonlocal engine, sync_result
        try:
            # [NEW] DB Knowledge Base 동기화 (Sync Hook)
            try:
                user_id_str = execution_context.get("user_id")
                if user_id_str:
                    from apps.workflow_engine.services.sync_service import SyncService

                    user_id = uuid.UUID(user_id_str)
                    syncer = SyncService(db=session, user_id=user_id)
                    sync_result = syncer.sync_knowledge_bases(graph)
            except Exception as e:
                logger.error(f"[Workflow-Engine] 동기화 훅 실패: {e}")

            engine = WorkflowEngine(
                graph=graph,
                user_input=user_input,
                execution_context=execution_context,
                is_deployed=is_deployed,
                db=session,
            )

            result = await engine.execute()
            return {"status": "success", "result": result, "sync_status": sync_result}
        finally:
            await _cleanup_resources(engine)

    try:
        return _run_async(_execute())
    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_workflow 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()


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
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

    async def _execute():
        nonlocal engine
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

            graph = deployment.graph_data
            execution_context["workflow_id"] = workflow_id

            sync_result = {}
            try:
                user_id_str = execution_context.get("user_id")
                if user_id_str:
                    from apps.workflow_engine.services.sync_service import SyncService

                    user_id = uuid.UUID(user_id_str)
                    syncer = SyncService(db=session, user_id=user_id)
                    sync_result = syncer.sync_knowledge_bases(graph)
            except Exception as e:
                logger.error(f"[Workflow-Engine] 동기화 훅 실패: {e}")

            engine = WorkflowEngine(
                graph=graph,
                user_input=user_input,
                execution_context=execution_context,
                is_deployed=True,
                db=session,
            )

            result = await engine.execute()
            return {"status": "success", "result": result, "sync_status": sync_result}
        finally:
            await _cleanup_resources(engine)

    try:
        return _run_async(_execute())
    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_deployed_workflow 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()


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
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

    async def _execute():
        nonlocal engine
        try:
            deployment = (
                session.query(WorkflowDeployment)
                .filter(WorkflowDeployment.id == deployment_id)
                .first()
            )

            if not deployment:
                raise ValueError(f"배포를 찾을 수 없습니다: {deployment_id}")

            if not deployment.graph_snapshot:
                raise ValueError(f"배포 그래프 데이터가 없습니다: {deployment_id}")

            sync_result = {}
            try:
                user_id_str = execution_context.get("user_id")
                if user_id_str:
                    from apps.workflow_engine.services.sync_service import SyncService

                    user_id = uuid.UUID(user_id_str)
                    syncer = SyncService(db=session, user_id=user_id)
                    sync_result = syncer.sync_knowledge_bases(deployment.graph_snapshot)
            except Exception as e:
                logger.error(f"[Workflow-Engine] 동기화 훅 실패: {e}")

            engine = WorkflowEngine(
                graph=deployment.graph_snapshot,
                user_input=user_input,
                execution_context=execution_context,
                is_deployed=True,
                db=session,
            )

            result = await engine.execute()
            return {"status": "success", "result": result, "sync_status": sync_result}
        finally:
            await _cleanup_resources(engine)

    try:
        return _run_async(_execute())
    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_by_deployment 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()


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

    async def _execute():
        nonlocal engine
        try:
            execution_context["workflow_run_id"] = external_run_id

            sync_result = {}
            try:
                user_id_str = execution_context.get("user_id")
                if user_id_str:
                    from apps.workflow_engine.services.sync_service import SyncService

                    user_id = uuid.UUID(user_id_str)
                    syncer = SyncService(db=session, user_id=user_id)
                    sync_result = syncer.sync_knowledge_bases(graph)

                    if sync_result.get("failed"):
                        from apps.shared.pubsub import publish_workflow_event

                        publish_workflow_event(
                            external_run_id, "sync_warning", sync_result
                        )

            except Exception as e:
                logger.error(f"[Workflow-Engine] 동기화 훅 실패: {e}")

            engine = WorkflowEngine(
                graph=graph,
                user_input=user_input,
                execution_context=execution_context,
                is_deployed=False,
                db=session,
            )

            # 스트리밍 모드로 실행
            final_result = {}
            async for event in engine.execute_stream():
                if event.get("type") == "workflow_finish":
                    final_result = event.get("data", {})
                elif event.get("type") == "error":
                    raise ValueError(
                        event.get("data", {}).get("message", "Unknown error")
                    )

            return {
                "status": "success",
                "result": final_result,
                "sync_status": sync_result,
            }
        finally:
            await _cleanup_resources(engine)

    try:
        return _run_async(_execute())
    except Exception as e:
        logger.error(f"[Workflow-Engine] stream_workflow 실패: {e}")
        from apps.shared.pubsub import publish_workflow_event

        publish_workflow_event(external_run_id, "error", {"message": str(e)})
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
