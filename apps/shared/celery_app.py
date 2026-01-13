"""
Moduly Celery 앱 설정

마이크로서비스 간 비동기 통신을 위한 Celery 설정입니다.
- 브로커: Redis
- 결과 백엔드: Redis
- 태스크 라우팅: workflow, log 큐로 분리
"""

import os

from celery import Celery

# Redis URL 설정
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
    # 시간대 설정
    timezone="Asia/Seoul",
    enable_utc=True,
    # 태스크 라우팅: 큐별로 분리
    task_routes={
        "workflow.*": {"queue": "workflow"},
        "log.*": {"queue": "log"},
    },
    # 태스크 설정
    task_track_started=True,  # 태스크 시작 상태 추적
    task_time_limit=600,  # 태스크 최대 실행 시간 (10분)
    task_soft_time_limit=540,  # 소프트 타임아웃 (9분)
    # 워커 설정
    worker_prefetch_multiplier=1,  # 메모리 효율 (한 번에 하나씩)
    worker_concurrency=4,  # 동시 실행 워커 수
    # 결과 설정
    result_expires=3600,  # 결과 만료 시간 (1시간)
)
