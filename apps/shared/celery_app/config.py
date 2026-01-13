"""
Celery 설정

모든 마이크로서비스가 공유하는 Celery 앱 설정입니다.
- Gateway: 태스크 발행
- Workflow Engine: workflow 큐 처리
- Log System: logs 큐 처리
"""
import os

from celery import Celery

# Redis URL (환경변수로 설정 가능)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Celery 앱 생성
celery_app = Celery(
    "moduly",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# Celery 설정
celery_app.conf.update(
    # 직렬화 설정
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # 타임존 설정
    timezone="Asia/Seoul",
    enable_utc=True,
    
    # 태스크 추적 설정
    task_track_started=True,
    task_time_limit=600,  # 10분 타임아웃
    
    # 태스크 라우팅 (큐별 분리)
    task_routes={
        "workflow.*": {"queue": "workflow"},
        "logs.*": {"queue": "logs"},
    },
    
    # 재시도 설정
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # 결과 만료 설정 (1시간)
    result_expires=3600,
)

# 태스크 자동 등록 (각 서비스의 tasks 모듈)
# 각 서비스에서 필요한 태스크를 등록할 때 사용
# celery_app.autodiscover_tasks(["apps.workflow_engine.tasks", "apps.log_system.tasks"])
