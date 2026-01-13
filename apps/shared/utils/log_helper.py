"""
로그 헬퍼 함수

Workflow Engine에서 사용하는 간편한 로그 전송 함수들입니다.
내부적으로 Celery 태스크를 호출합니다.
"""
from typing import Any, Dict, Optional

from apps.shared.celery_app.config import celery_app


def log_workflow_run_start(
    run_id: str,
    workflow_id: str,
    user_id: str,
    inputs: Dict[str, Any],
    deployment_id: Optional[str] = None,
    workflow_version: Optional[int] = None,
    trigger_mode: str = "api",
) -> None:
    """
    워크플로우 실행 시작 로그 (비동기)
    """
    celery_app.send_task(
        "logs.create_workflow_run",
        args=[{
            "id": run_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "deployment_id": deployment_id,
            "workflow_version": workflow_version,
            "trigger_mode": trigger_mode,
            "inputs": inputs,
            "status": "running",
        }],
        queue="logs",
    )


def log_workflow_run_finish(
    run_id: str,
    status: str,
    outputs: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    total_tokens: Optional[int] = None,
    total_cost: Optional[float] = None,
) -> None:
    """
    워크플로우 실행 완료 로그 (비동기)
    """
    data = {"status": status}
    if outputs is not None:
        data["outputs"] = outputs
    if error_message is not None:
        data["error_message"] = error_message
    if total_tokens is not None:
        data["total_tokens"] = total_tokens
    if total_cost is not None:
        data["total_cost"] = total_cost

    celery_app.send_task(
        "logs.update_workflow_run",
        args=[run_id, data],
        queue="logs",
    )


def log_node_run_start(
    run_id: str,
    node_id: str,
    node_type: str,
    inputs: Dict[str, Any],
    process_data: Optional[Dict[str, Any]] = None,
) -> None:
    """
    노드 실행 시작 로그 (비동기)
    """
    celery_app.send_task(
        "logs.create_node_run",
        args=[{
            "workflow_run_id": run_id,
            "node_id": node_id,
            "node_type": node_type,
            "inputs": inputs,
            "process_data": process_data or {},
            "status": "running",
        }],
        queue="logs",
    )


def log_node_run_finish(
    run_id: str,
    node_id: str,
    status: str,
    outputs: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    노드 실행 완료 로그 (비동기)
    """
    data = {"status": status}
    if outputs is not None:
        data["outputs"] = outputs
    if error_message is not None:
        data["error_message"] = error_message

    celery_app.send_task(
        "logs.update_node_run",
        args=[run_id, node_id, data],
        queue="logs",
    )
