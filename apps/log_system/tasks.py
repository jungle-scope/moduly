"""
Log System Celery 태스크

워크플로우 실행 로그를 DB에 저장하는 Celery 태스크들입니다.
기존 LogWorkerPool의 역할을 Celery 태스크로 대체합니다.
"""

import logging
import uuid
from typing import Any, Dict

from apps.shared.celery_app import celery_app
from apps.shared.db.models.app import App  # noqa: F401
from apps.shared.db.models.connection import Connection  # noqa: F401
from apps.shared.db.models.knowledge import (  # noqa: F401
    Document,
    DocumentChunk,
    KnowledgeBase,
)
from apps.shared.db.models.llm import (  # noqa: F401
    LLMCredential,
    LLMModel,
    LLMProvider,
    LLMRelCredentialModel,
    LLMUsageLog,
)
from apps.shared.db.models.schedule import Schedule  # noqa: F401

# SQLAlchemy 모델 relationship 초기화를 위해 모든 모델을 명시적으로 import
# 순서 중요: 의존성 순서대로 import해야 관계가 올바르게 초기화됨
from apps.shared.db.models.user import User  # noqa: F401
from apps.shared.db.models.workflow import Workflow  # noqa: F401
from apps.shared.db.models.workflow_deployment import WorkflowDeployment  # noqa: F401
from apps.shared.db.models.workflow_run import (
    NodeRunStatus,
    RunStatus,
    RunTriggerMode,
    WorkflowNodeRun,
    WorkflowRun,
)
from apps.shared.db.session import SessionLocal
from sqlalchemy import func

logger = logging.getLogger(__name__)


def _serialize_uuid(obj):
    """UUID를 문자열로 변환 (JSON 직렬화용)"""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    return obj


def _deserialize_uuid(value):
    """문자열을 UUID로 변환"""
    if isinstance(value, str):
        try:
            return uuid.UUID(value)
        except ValueError:
            return value
    return value


def _deserialize_datetime(value):
    """ISO 문자열을 datetime으로 변환"""
    from datetime import datetime

    if isinstance(value, str):
        try:
            # ISO 형식 문자열을 datetime으로 변환
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    return value


@celery_app.task(name="log.create_run", bind=True, max_retries=3)
def create_run_log(self, data: Dict[str, Any]):
    """워크플로우 실행 로그 생성"""
    session = SessionLocal()
    try:
        # 트리거 모드 정규화
        trigger_mode = data.get("trigger_mode")
        if isinstance(trigger_mode, str):
            trigger_mode = trigger_mode.strip().lower()

        trigger_mode_map = {
            "manual": RunTriggerMode.MANUAL,
            "api": RunTriggerMode.API,
            "app": RunTriggerMode.API,
            "deployed": RunTriggerMode.API,
        }

        normalized_trigger = None
        if isinstance(trigger_mode, RunTriggerMode):
            normalized_trigger = trigger_mode
        elif isinstance(trigger_mode, str):
            normalized_trigger = trigger_mode_map.get(trigger_mode)

        if normalized_trigger is None:
            normalized_trigger = (
                RunTriggerMode.API if data.get("is_deployed") else RunTriggerMode.MANUAL
            )

        # UUID 변환
        run_id = _deserialize_uuid(data["run_id"])
        workflow_id = _deserialize_uuid(data["workflow_id"])
        user_id = _deserialize_uuid(data["user_id"])
        deployment_id = (
            _deserialize_uuid(data.get("deployment_id"))
            if data.get("deployment_id")
            else None
        )

        run_log = WorkflowRun(
            id=run_id,
            workflow_id=workflow_id,
            user_id=user_id,
            status=RunStatus.RUNNING,
            trigger_mode=normalized_trigger,
            inputs=data.get("user_input") or {},
            started_at=data["started_at"],
            deployment_id=deployment_id,
            workflow_version=data.get("workflow_version"),
        )
        session.add(run_log)
        session.commit()

        return {"status": "success", "run_id": str(run_id)}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] create_run_log 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()


@celery_app.task(name="log.update_run_finish", bind=True, max_retries=3)
def update_run_log_finish(self, data: Dict[str, Any]):
    """워크플로우 실행 완료 로그 업데이트"""
    session = SessionLocal()
    try:
        run_id = _deserialize_uuid(data["run_id"])

        run_log = session.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()

        if not run_log:
            # 아직 생성되지 않은 경우 재시도
            raise Exception(f"WorkflowRun not found: {run_id}")

        run_log.status = RunStatus.SUCCESS
        run_log.outputs = data["outputs"]
        finished_at = _deserialize_datetime(data["finished_at"])
        run_log.finished_at = finished_at

        if run_log.started_at and finished_at:
            run_log.duration = (finished_at - run_log.started_at).total_seconds()

        # 비용 및 토큰 집계
        stats = (
            session.query(
                func.sum(
                    LLMUsageLog.prompt_tokens + LLMUsageLog.completion_tokens
                ).label("total_tokens"),
                func.sum(LLMUsageLog.total_cost).label("total_cost"),
            )
            .filter(LLMUsageLog.workflow_run_id == run_id)
            .first()
        )

        if stats:
            run_log.total_tokens = stats.total_tokens or 0
            run_log.total_cost = stats.total_cost or 0.0

        session.commit()

        return {"status": "success", "run_id": str(run_id)}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] update_run_log_finish 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()


@celery_app.task(name="log.update_run_error", bind=True, max_retries=3)
def update_run_log_error(self, data: Dict[str, Any]):
    """워크플로우 실행 에러 로그 업데이트"""
    session = SessionLocal()
    try:
        run_id = _deserialize_uuid(data["run_id"])

        run_log = session.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()

        if not run_log:
            raise Exception(f"WorkflowRun not found: {run_id}")

        run_log.status = RunStatus.FAILED
        run_log.error_message = data["error_message"]
        finished_at = _deserialize_datetime(data["finished_at"])
        run_log.finished_at = finished_at

        if run_log.started_at and finished_at:
            run_log.duration = (finished_at - run_log.started_at).total_seconds()

        session.commit()

        return {"status": "success", "run_id": str(run_id)}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] update_run_log_error 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()


@celery_app.task(name="log.create_node", bind=True, max_retries=3)
def create_node_log(self, data: Dict[str, Any]):
    """노드 실행 로그 생성"""
    session = SessionLocal()
    try:
        workflow_run_id = _deserialize_uuid(data["workflow_run_id"])

        # 부모 WorkflowRun이 존재하는지 확인
        run_exists = (
            session.query(WorkflowRun.id)
            .filter(WorkflowRun.id == workflow_run_id)
            .first()
        )

        if not run_exists:
            raise Exception(f"WorkflowRun not found: {workflow_run_id}")

        node_run = WorkflowNodeRun(
            workflow_run_id=workflow_run_id,
            node_id=data["node_id"],
            node_type=data["node_type"],
            status=NodeRunStatus.RUNNING,
            inputs=data.get("inputs") or {},
            process_data=data.get("process_data") or {},
            started_at=data["started_at"],
        )
        session.add(node_run)
        session.commit()

        return {"status": "success", "node_id": data["node_id"]}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] create_node_log 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()


@celery_app.task(name="log.update_node_finish", bind=True, max_retries=3)
def update_node_log_finish(self, data: Dict[str, Any]):
    """노드 실행 완료 로그 업데이트"""
    session = SessionLocal()
    try:
        workflow_run_id = _deserialize_uuid(data["workflow_run_id"])

        node_run = (
            session.query(WorkflowNodeRun)
            .filter(WorkflowNodeRun.workflow_run_id == workflow_run_id)
            .filter(WorkflowNodeRun.node_id == data["node_id"])
            .order_by(WorkflowNodeRun.started_at.desc())
            .first()
        )

        if not node_run:
            raise Exception(
                f"WorkflowNodeRun not found: {workflow_run_id}/{data['node_id']}"
            )

        node_run.status = NodeRunStatus.SUCCESS
        outputs = data["outputs"]
        if isinstance(outputs, dict):
            node_run.outputs = outputs
        else:
            node_run.outputs = {"result": outputs}

        node_run.finished_at = _deserialize_datetime(data["finished_at"])
        session.commit()

        return {"status": "success", "node_id": data["node_id"]}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] update_node_log_finish 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()


@celery_app.task(name="log.update_node_error", bind=True, max_retries=3)
def update_node_log_error(self, data: Dict[str, Any]):
    """노드 실행 에러 로그 업데이트"""
    session = SessionLocal()
    try:
        workflow_run_id = _deserialize_uuid(data["workflow_run_id"])

        node_run = (
            session.query(WorkflowNodeRun)
            .filter(WorkflowNodeRun.workflow_run_id == workflow_run_id)
            .filter(WorkflowNodeRun.node_id == data["node_id"])
            .order_by(WorkflowNodeRun.started_at.desc())
            .first()
        )

        if not node_run:
            raise Exception(
                f"WorkflowNodeRun not found: {workflow_run_id}/{data['node_id']}"
            )

        node_run.status = NodeRunStatus.FAILED
        node_run.error_message = data["error_message"]
        node_run.finished_at = _deserialize_datetime(data["finished_at"])
        session.commit()

        return {"status": "success", "node_id": data["node_id"]}

    except Exception as e:
        session.rollback()
        logger.error(f"[Log-System] update_node_log_error 실패: {e}")
        raise self.retry(exc=e, countdown=2**self.request.retries)
    finally:
        session.close()
