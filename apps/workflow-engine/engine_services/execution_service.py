"""
워크플로우 실행 서비스

WorkflowEngine을 사용하여 워크플로우를 실행합니다.
"""

import json
from typing import Any, AsyncGenerator, Dict, Optional

from shared.db.models.workflow import Workflow
from sqlalchemy.orm import Session
from workflow.core.workflow_engine import WorkflowEngine


class ExecutionService:
    """워크플로우 실행 전담 서비스"""

    @staticmethod
    def _get_graph(db: Session, workflow_id: str) -> Optional[Dict[str, Any]]:
        """워크플로우 그래프 데이터 조회"""
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            return None

        data = workflow.graph if workflow.graph else {}
        if workflow.features:
            data["features"] = workflow.features
        return data

    @staticmethod
    async def execute(
        db: Session,
        workflow_id: str,
        user_id: str,
        user_input: Dict[str, Any],
        is_deployed: bool = False,
        deployment_id: Optional[str] = None,
        workflow_version: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        워크플로우 동기 실행
        """
        graph = ExecutionService._get_graph(db, workflow_id)
        if not graph:
            return {
                "run_id": "",
                "status": "failed",
                "outputs": None,
                "error": f"Workflow '{workflow_id}' not found",
            }

        # memory_mode 분리
        memory_mode_enabled = (
            bool(user_input.pop("memory_mode", False))
            if isinstance(user_input, dict)
            else False
        )

        try:
            engine = WorkflowEngine(
                graph,
                user_input,
                execution_context={
                    "user_id": user_id,
                    "workflow_id": workflow_id,
                    "memory_mode": memory_mode_enabled,
                    "is_deployed": is_deployed,
                    "deployment_id": deployment_id,
                    "workflow_version": workflow_version,
                },
                db=db,
            )

            result = await engine.execute()

            return {
                "run_id": str(getattr(engine.logger, "workflow_run_id", "")),
                "status": "success",
                "outputs": result,
                "error": None,
            }
        except Exception as e:
            return {
                "run_id": "",
                "status": "failed",
                "outputs": None,
                "error": str(e),
            }

    @staticmethod
    async def stream(
        db: Session,
        workflow_id: str,
        user_id: str,
        user_input: Dict[str, Any],
        is_deployed: bool = False,
        deployment_id: Optional[str] = None,
        workflow_version: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        워크플로우 SSE 스트리밍 실행
        """
        graph = ExecutionService._get_graph(db, workflow_id)
        if not graph:
            error_event = {
                "type": "error",
                "data": {"message": f"Workflow '{workflow_id}' not found"},
            }
            yield f"data: {json.dumps(error_event)}\n\n"
            return

        # memory_mode 분리
        memory_mode_enabled = (
            bool(user_input.pop("memory_mode", False))
            if isinstance(user_input, dict)
            else False
        )

        try:
            engine = WorkflowEngine(
                graph,
                user_input,
                execution_context={
                    "user_id": user_id,
                    "workflow_id": workflow_id,
                    "memory_mode": memory_mode_enabled,
                    "is_deployed": is_deployed,
                    "deployment_id": deployment_id,
                    "workflow_version": workflow_version,
                },
                db=db,
            )

            async for event in engine.execute_stream():
                yield f"data: {json.dumps(event)}\n\n"

        except Exception as e:
            error_event = {"type": "error", "data": {"message": str(e)}}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            if "engine" in locals():
                engine.logger.shutdown()

    @staticmethod
    async def run_deployed(
        db: Session,
        url_slug: str,
        user_id: str,
        user_input: Dict[str, Any],
        deployment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        배포된 워크플로우 실행

        url_slug로 배포 정보를 조회하고 워크플로우를 실행합니다.
        """
        from shared.db.models.app import App
        from shared.db.models.workflow_deployment import WorkflowDeployment

        deployment = None
        app = None

        # 1. deployment_id가 있으면 우선 조회 (Gateway에서 넘겨준 경우)
        if deployment_id:
            deployment = (
                db.query(WorkflowDeployment)
                .filter(WorkflowDeployment.id == deployment_id)
                .first()
            )
            if deployment:
                app = db.query(App).filter(App.id == deployment.app_id).first()

        # 2. 없으면 url_slug로 조회 (App 테이블 조인)
        if not deployment or not app:
            result = (
                db.query(WorkflowDeployment, App)
                .join(App, App.active_deployment_id == WorkflowDeployment.id)
                .filter(
                    App.url_slug == url_slug,
                    WorkflowDeployment.is_active == True,
                )
                .first()
            )
            if result:
                deployment, app = result

        if not deployment or not app:
            return {
                "run_id": "",
                "status": "failed",
                "outputs": None,
                "error": f"배포를 찾을 수 없습니다: {url_slug}",
            }

        return await ExecutionService.execute(
            db=db,
            workflow_id=str(app.workflow_id),  # App에서 workflow_id 가져옴
            user_id=user_id,
            user_input=user_input,
            is_deployed=True,
            deployment_id=str(deployment.id),
            workflow_version=deployment.version,
        )
