"""
워크플로우 실행 Celery 태스크

Gateway에서 호출되어 워크플로우를 실행하고,
Redis Pub/Sub를 통해 실시간 이벤트를 발행합니다.
"""
from typing import Any, Dict, Optional

from apps.shared.celery_app.config import celery_app
from apps.shared.redis.pubsub import publish_event, get_channel_name
from apps.shared.db.session import SessionLocal
from apps.shared.utils.log_helper import (
    log_workflow_run_start,
    log_workflow_run_finish,
    log_node_run_start,
    log_node_run_finish,
)


@celery_app.task(
    name="workflow.execute",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="workflow",
)
def execute_workflow(
    self,
    run_id: str,
    workflow_id: str,
    graph_data: Dict[str, Any],
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    워크플로우 실행 태스크
    
    실행 중 Redis Pub/Sub를 통해 실시간 이벤트 발행
    
    Args:
        run_id: 실행 고유 ID
        workflow_id: 워크플로우 ID
        graph_data: 워크플로우 그래프 데이터 (nodes, edges)
        user_input: 사용자 입력값
        execution_context: 실행 컨텍스트 {
            "user_id": str,
            "deployment_id": str (optional),
            "workflow_version": int (optional),
            "is_deployed": bool,
        }
    
    Returns:
        실행 결과 {"outputs": dict, "status": str}
    """
    channel = get_channel_name(run_id)
    db = SessionLocal()
    
    try:
        # 실행 시작 로그
        log_workflow_run_start(
            run_id=run_id,
            workflow_id=workflow_id,
            user_id=execution_context.get("user_id", ""),
            inputs=user_input,
            deployment_id=execution_context.get("deployment_id"),
            workflow_version=execution_context.get("workflow_version"),
            trigger_mode="api" if execution_context.get("is_deployed") else "manual",
        )
        
        # 워크플로우 엔진 임포트 및 실행
        from apps.workflow_engine.core.engine import WorkflowEngine
        
        engine = WorkflowEngine(
            graph=graph_data,
            user_input=user_input,
            db=db,
            workflow_id=workflow_id,
            run_id=run_id,
            event_publisher=lambda event_type, data: publish_event(channel, event_type, data),
            **execution_context,
        )
        
        result = engine.execute_with_events()
        
        # 완료 이벤트 발행
        publish_event(channel, "workflow_finish", {
            "run_id": run_id,
            "outputs": result.get("outputs", {}),
            "status": "success",
        })
        
        # 완료 로그
        log_workflow_run_finish(
            run_id=run_id,
            status="success",
            outputs=result.get("outputs"),
            total_tokens=result.get("total_tokens"),
            total_cost=result.get("total_cost"),
        )
        
        return result
        
    except Exception as e:
        # 에러 이벤트 발행
        publish_event(channel, "error", {
            "run_id": run_id,
            "error": str(e),
        })
        
        # 에러 로그
        log_workflow_run_finish(
            run_id=run_id,
            status="failed",
            error_message=str(e),
        )
        
        raise
        
    finally:
        db.close()


@celery_app.task(
    name="workflow.execute_async",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="workflow",
)
def execute_workflow_async(
    self,
    run_id: str,
    workflow_id: str,
    graph_data: Dict[str, Any],
    user_input: Dict[str, Any],
    execution_context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    비동기 워크플로우 실행 (SSE 스트리밍 불필요 시)
    
    Redis Pub/Sub 이벤트 발행 없이 실행만 수행
    """
    db = SessionLocal()
    
    try:
        # 실행 시작 로그
        log_workflow_run_start(
            run_id=run_id,
            workflow_id=workflow_id,
            user_id=execution_context.get("user_id", ""),
            inputs=user_input,
            deployment_id=execution_context.get("deployment_id"),
            workflow_version=execution_context.get("workflow_version"),
            trigger_mode="api",
        )
        
        from apps.workflow_engine.core.engine import WorkflowEngine
        
        engine = WorkflowEngine(
            graph=graph_data,
            user_input=user_input,
            db=db,
            workflow_id=workflow_id,
            run_id=run_id,
            event_publisher=None,  # 이벤트 발행 없음
            **execution_context,
        )
        
        result = engine.execute_with_events()
        
        log_workflow_run_finish(
            run_id=run_id,
            status="success",
            outputs=result.get("outputs"),
            total_tokens=result.get("total_tokens"),
            total_cost=result.get("total_cost"),
        )
        
        return result
        
    except Exception as e:
        log_workflow_run_finish(
            run_id=run_id,
            status="failed",
            error_message=str(e),
        )
        raise
        
    finally:
        db.close()
