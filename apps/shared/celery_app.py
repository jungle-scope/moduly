"""
Moduly Celery 앱 설정

마이크로서비스 간 비동기 통신을 위한 Celery 설정입니다.
- 브로커: Redis (DB 0)
- 결과 백엔드: Redis (DB 1) - [NEW] 브로커와 분리하여 I/O 경합 방지
- 태스크 라우팅: workflow, log 큐로 분리
"""

import os

from celery import Celery

# Redis 연결 설정 (개별 환경변수로 URL 동적 생성 )
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_BROKER_DB = os.getenv("REDIS_BROKER_DB", "0")  # [NEW] 브로커용 DB
REDIS_BACKEND_DB = os.getenv("REDIS_BACKEND_DB", "1")  # [NEW] 결과 백엔드용 DB

# 비밀번호 유무에 따라 Redis URL 생성
if REDIS_PASSWORD:
    REDIS_BROKER_URL = (
        f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_BROKER_DB}"
    )
    REDIS_BACKEND_URL = (
        f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_BACKEND_DB}"
    )
else:
    REDIS_BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_BROKER_DB}"
    REDIS_BACKEND_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_BACKEND_DB}"

# Celery 앱 생성 - [FIX] 브로커와 백엔드 분리
celery_app = Celery(
    "moduly",
    broker=REDIS_BROKER_URL,
    backend=REDIS_BACKEND_URL,
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
    task_track_started=False,  # [FIX] STARTED 상태 추적 비활성화 (Protocol Error 방지)
    task_time_limit=600,  # 태스크 최대 실행 시간 (10분)
    task_soft_time_limit=540,  # 소프트 타임아웃 (9분)
    # 워커 설정
    worker_prefetch_multiplier=4,  # [FIX] 프리페치 증가 (1 → 4)
    worker_concurrency=16,  # [FIX] 동시 실행 워커 수 증가 (4 → 16)
    # 결과 설정
    result_expires=3600,  # 결과 만료 시간 (1시간)
    # Heartbeat 설정 (LLM/Code 노드 실행 시 안정성 향상)
    broker_heartbeat=120,  # 브로커 heartbeat 간격 (기본 60초 → 120초)
    worker_send_task_events=True,  # 워커 이벤트 전송
    worker_pool_restarts=True,  # 워커 풀 재시작 활성화
    # [NEW] Redis 연결 풀 설정 (연결 경합 방지)
    broker_pool_limit=20,  # 브로커 연결 풀 크기
    redis_max_connections=20,  # Redis 최대 연결 수
    result_backend_transport_options={
        "max_connections": 20,  # 결과 백엔드 연결 풀
    },
)
