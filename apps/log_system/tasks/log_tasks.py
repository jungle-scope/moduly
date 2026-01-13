"""
로그 저장 Celery 태스크

Workflow Engine에서 호출되어 로그를 DB에 저장합니다.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from apps.shared.celery_app.config import celery_app
from apps.shared.db.session import SessionLocal
from apps.shared.db.models.workflow_run import (
    WorkflowRun,
    WorkflowNodeRun,
    RunStatus,
    RunTriggerMode,
    NodeRunStatus,
)


@celery_app.task(name="logs.create_workflow_run", queue="logs")
def create_workflow_run_log(data: Dict[str, Any]) -> str:
    """
    워크플로우 실행 로그 생성
    
    Args:
        data: {
            "id": str (run_id),
            "workflow_id": str,
            "user_id": str,
            "deployment_id": str (optional),
            "workflow_version": int (optional),
            "trigger_mode": str ("manual" or "api"),
            "inputs": dict,
            "status": str ("running"),
        }
    
    Returns:
        생성된 run_id
    """
    db = SessionLocal()
    try:
        run = WorkflowRun(
            id=UUID(data["id"]),
            workflow_id=UUID(data["workflow_id"]),
            user_id=UUID(data["user_id"]),
            deployment_id=UUID(data["deployment_id"]) if data.get("deployment_id") else None,
            workflow_version=data.get("workflow_version"),
            trigger_mode=RunTriggerMode(data.get("trigger_mode", "api")),
            status=RunStatus(data.get("status", "running")),
            inputs=data.get("inputs", {}),
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)
        db.commit()
        return data["id"]
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="logs.update_workflow_run", queue="logs")
def update_workflow_run_log(run_id: str, data: Dict[str, Any]) -> bool:
    """
    워크플로우 실행 로그 업데이트
    
    Args:
        run_id: 실행 ID
        data: {
            "status": str ("success" or "failed"),
            "outputs": dict (optional),
            "error_message": str (optional),
            "total_tokens": int (optional),
            "total_cost": float (optional),
        }
    
    Returns:
        업데이트 성공 여부
    """
    db = SessionLocal()
    try:
        run = db.query(WorkflowRun).filter(WorkflowRun.id == UUID(run_id)).first()
        if not run:
            return False
        
        # 상태 업데이트
        if "status" in data:
            run.status = RunStatus(data["status"])
        
        # 출력값 업데이트
        if "outputs" in data:
            run.outputs = data["outputs"]
        
        # 에러 메시지 업데이트
        if "error_message" in data:
            run.error_message = data["error_message"]
        
        # 토큰/비용 업데이트
        if "total_tokens" in data:
            run.total_tokens = data["total_tokens"]
        if "total_cost" in data:
            run.total_cost = data["total_cost"]
        
        # 완료 시간 및 소요 시간 계산
        run.finished_at = datetime.now(timezone.utc)
        if run.started_at:
            run.duration = (run.finished_at - run.started_at).total_seconds()
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="logs.create_node_run", queue="logs")
def create_node_run_log(data: Dict[str, Any]) -> str:
    """
    노드 실행 로그 생성
    
    Args:
        data: {
            "id": str (optional, 자동 생성),
            "workflow_run_id": str,
            "node_id": str,
            "node_type": str,
            "inputs": dict,
            "process_data": dict,
            "status": str ("running"),
        }
    
    Returns:
        생성된 node_run_id
    """
    db = SessionLocal()
    try:
        node_run = WorkflowNodeRun(
            workflow_run_id=UUID(data["workflow_run_id"]),
            node_id=data["node_id"],
            node_type=data["node_type"],
            status=NodeRunStatus(data.get("status", "running")),
            inputs=data.get("inputs", {}),
            process_data=data.get("process_data", {}),
            started_at=datetime.now(timezone.utc),
        )
        db.add(node_run)
        db.commit()
        db.refresh(node_run)
        return str(node_run.id)
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="logs.update_node_run", queue="logs")
def update_node_run_log(
    run_id: str,
    node_id: str,
    data: Dict[str, Any]
) -> bool:
    """
    노드 실행 로그 업데이트
    
    Args:
        run_id: 워크플로우 실행 ID
        node_id: 노드 ID
        data: {
            "status": str ("success" or "failed"),
            "outputs": dict (optional),
            "error_message": str (optional),
        }
    
    Returns:
        업데이트 성공 여부
    """
    db = SessionLocal()
    try:
        node_run = (
            db.query(WorkflowNodeRun)
            .filter(
                WorkflowNodeRun.workflow_run_id == UUID(run_id),
                WorkflowNodeRun.node_id == node_id,
            )
            .first()
        )
        if not node_run:
            return False
        
        # 상태 업데이트
        if "status" in data:
            node_run.status = NodeRunStatus(data["status"])
        
        # 출력값 업데이트
        if "outputs" in data:
            node_run.outputs = data["outputs"]
        
        # 에러 메시지 업데이트
        if "error_message" in data:
            node_run.error_message = data["error_message"]
        
        # 완료 시간
        node_run.finished_at = datetime.now(timezone.utc)
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
