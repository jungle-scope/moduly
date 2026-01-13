"""
Log System - Celery Worker 진입점

사용법:
    celery -A apps.log_system.worker worker -Q logs --loglevel=info
"""
from apps.shared.celery_app.config import celery_app

# 태스크 모듈 임포트 (자동 등록)
from apps.log_system.tasks import log_tasks  # noqa: F401

# Worker 설정
celery_app.conf.update(
    # 이 워커가 처리할 큐
    task_queues={
        "logs": {
            "exchange": "logs",
            "routing_key": "logs",
        }
    }
)
