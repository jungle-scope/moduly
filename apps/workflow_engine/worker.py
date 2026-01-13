"""
Workflow Engine - Celery Worker 진입점

HTTP 서버 없이 Celery Worker로만 동작합니다.
실시간 스트리밍은 Redis Pub/Sub를 통해 Gateway로 전달됩니다.

사용법:
    celery -A apps.workflow_engine.worker worker -Q workflow --loglevel=info
"""
from apps.shared.celery_app.config import celery_app

# 태스크 모듈 임포트 (자동 등록)
from apps.workflow_engine.tasks import workflow_tasks  # noqa: F401

# Worker 설정
celery_app.conf.update(
    # 이 워커가 처리할 큐
    task_queues={
        "workflow": {
            "exchange": "workflow",
            "routing_key": "workflow",
        }
    }
)
