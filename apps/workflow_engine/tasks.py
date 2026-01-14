"""
Workflow-Engine Celery 태스크 정의
워크플로우 실행을 비동기적으로 처리
"""

import asyncio
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
    try:
        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=is_deployed,
            db=session,
        )

        # 비동기 실행을 동기로 래핑
        result = asyncio.run(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_workflow 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
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
    from workflow.core.workflow_engine import WorkflowEngine

    from apps.shared.db.models.workflow_deployment import WorkflowDeployment

    session = SessionLocal()
    try:
        # 배포된 워크플로우 조회
        deployment = (
            session.query(WorkflowDeployment)
            .filter(WorkflowDeployment.workflow_id == workflow_id)
            .filter(WorkflowDeployment.is_active == True)
            .first()
        )

        if not deployment:
            raise ValueError(f"배포된 워크플로우를 찾을 수 없습니다: {workflow_id}")

        # 저장된 그래프 데이터로 엔진 생성
        graph = deployment.graph_data

        # execution_context에 workflow_id 추가
        execution_context["workflow_id"] = workflow_id

        engine = WorkflowEngine(
            graph=graph,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=True,
            db=session,
        )

        # 비동기 실행을 동기로 래핑
        result = asyncio.run(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_deployed_workflow 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
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
    from workflow.core.workflow_engine import WorkflowEngine

    from apps.shared.db.models.workflow_deployment import WorkflowDeployment

    session = SessionLocal()
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

        engine = WorkflowEngine(
            graph=deployment.graph_snapshot,
            user_input=user_input,
            execution_context=execution_context,
            is_deployed=True,
            db=session,
        )

        # 비동기 실행을 동기로 래핑
        result = asyncio.run(engine.execute())
        return {"status": "success", "result": result}

    except Exception as e:
        print(f"[Workflow-Engine] execute_by_deployment 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()
