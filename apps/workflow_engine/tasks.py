"""
Workflow-Engine Celery 태스크 정의
워크플로우 실행을 비동기적으로 처리

[GEVENT FIX] gevent pool 환경에서 asyncio 호환성을 위해
gevent에서 제공하는 이벤트 루프를 직접 사용
"""

import asyncio
import logging
import uuid
from typing import Any, Dict

from apps.shared.celery_app import celery_app
from apps.shared.db.session import SessionLocal
from apps.shared.pubsub import close_async_redis_client

logger = logging.getLogger(__name__)


def _run_async_in_greenlet(coro):
    """
    [GEVENT FIX] gevent greenlet 내에서 asyncio 코루틴 실행

    gevent monkey patching이 적용되면 asyncio는 gevent hub를 사용.
    단, 이미 루프가 실행 중일 때 새 루프를 만들면 충돌.
    해결책: 각 greenlet에서 독립적인 이벤트 루프 생성 및 사용.
    """
    # 현재 스레드의 이벤트 루프 상태 초기화
    # gevent에서는 각 greenlet이 독립적인 컨텍스트를 가짐
    try:
        # 기존 루프가 있으면 가져오기
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        # 루프가 없으면 새로 생성
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        # 루프가 이미 실행 중인지 확인
        if loop.is_running():
            # 실행 중이면 새 루프 생성 (gevent에서는 각 greenlet마다)
            import gevent

            result_holder = {"result": None, "error": None}

            def _greenlet_runner():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    result_holder["result"] = new_loop.run_until_complete(coro)
                except Exception as e:
                    result_holder["error"] = e
                finally:
                    try:
                        new_loop.close()
                    except Exception:
                        pass
                    asyncio.set_event_loop(None)

            g = gevent.spawn(_greenlet_runner)
            g.join()

            if result_holder["error"]:
                raise result_holder["error"]
            return result_holder["result"]
        else:
            # 실행 중이 아니면 현재 루프 사용
            return loop.run_until_complete(coro)
    finally:
        # 루프 정리하지 않음 - gevent가 관리
        pass


async def _execute_with_cleanup(execute_func, engine_holder, session):
    """실행 및 리소스 정리를 위한 async 래퍼"""
    try:
        return await execute_func()
    finally:
        try:
            await close_async_redis_client()
        except Exception as e:
            logger.warning(f"Redis cleanup warning: {e}")


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

    # [GEVENT FIX] 새 이벤트 루프를 생성하고 현재 스레드에 설정
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

        # 워크플로우 실행 (async → sync 변환)
        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result, "sync_status": sync_result}

    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_workflow 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
        # Redis 클라이언트 정리
        try:
            loop.run_until_complete(close_async_redis_client())
        except Exception as e:
            logger.warning(f"Redis cleanup in finally: {e}")
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
    """
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
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

        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result, "sync_status": sync_result}

    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_deployed_workflow 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
        try:
            loop.run_until_complete(close_async_redis_client())
        except Exception:
            pass
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
    """
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

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

        result = loop.run_until_complete(engine.execute())
        return {"status": "success", "result": result, "sync_status": sync_result}

    except Exception as e:
        logger.error(f"[Workflow-Engine] execute_by_deployment 실패: {e}")
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
        try:
            loop.run_until_complete(close_async_redis_client())
        except Exception:
            pass
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
    """
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

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

                    publish_workflow_event(external_run_id, "sync_warning", sync_result)

        except Exception as e:
            logger.error(f"[Workflow-Engine] 동기화 훅 실패: {e}")

        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=False,
            db=session,
        )

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
        return {"status": "success", "result": result, "sync_status": sync_result}

    except Exception as e:
        logger.error(f"[Workflow-Engine] stream_workflow 실패: {e}")
        from apps.shared.pubsub import publish_workflow_event

        publish_workflow_event(external_run_id, "error", {"message": str(e)})
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
        try:
            loop.run_until_complete(close_async_redis_client())
        except Exception:
            pass
        loop.close()
        asyncio.set_event_loop(None)
