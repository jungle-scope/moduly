"""
Workflow-Engine Celery 태스크 정의
워크플로우 실행을 비동기적으로 처리

[GEVENT] WorkflowEngine이 동기화되어 asyncio가 더 이상 필요하지 않음.
"""

import logging
import uuid
from typing import Any, Dict

from apps.shared.celery_app import celery_app
from apps.shared.db.session import SessionLocal

logger = logging.getLogger(__name__)


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

    [GEVENT] WorkflowEngine이 동기화되어 단순화됨.

    Args:
        graph: 워크플로우 그래프 데이터
        user_input: 사용자 입력
        execution_context: 실행 컨텍스트
        is_deployed: 배포 모드 여부

    Returns:
        워크플로우 실행 결과
    """
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None
    sync_result = {}

    try:
        # Knowledge Base 동기화
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

        # [GEVENT] 직접 동기 호출 - asyncio 불필요
        result = engine.execute()
        return {"status": "success", "result": result, "sync_status": sync_result}

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

    [GEVENT] WorkflowEngine이 동기화되어 단순화됨.
    """
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

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

        # [GEVENT] 직접 동기 호출
        result = engine.execute()
        return {"status": "success", "result": result, "sync_status": sync_result}

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

    [GEVENT] WorkflowEngine이 동기화되어 단순화됨.
    """
    from apps.shared.db.models.workflow_deployment import WorkflowDeployment
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

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

        # [GEVENT] 직접 동기 호출
        result = engine.execute()
        return {"status": "success", "result": result, "sync_status": sync_result}

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

    [GEVENT] WorkflowEngine.execute_stream()이 이제 동기 제너레이터.
    """
    from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

    session = SessionLocal()
    engine = None

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

        # [GEVENT] 동기 제너레이터 사용
        final_result = {}
        for event in engine.execute_stream():
            if event.get("type") == "workflow_finish":
                final_result = event.get("data", {})
            elif event.get("type") == "error":
                raise ValueError(event.get("data", {}).get("message", "Unknown error"))

        return {"status": "success", "result": final_result, "sync_status": sync_result}

    except Exception as e:
        logger.error(f"[Workflow-Engine] stream_workflow 실패: {e}")
        from apps.shared.pubsub import publish_workflow_event

        publish_workflow_event(external_run_id, "error", {"message": str(e)})
        raise self.retry(exc=Exception(str(e)), countdown=2**self.request.retries)
    finally:
        if engine is not None:
            engine.cleanup()
        session.close()
