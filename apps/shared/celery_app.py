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
    worker_prefetch_multiplier=1,  # [FIX] 공정한 작업 분배를 위해 1로 설정 (Long-running task 최적화)
    worker_concurrency=4,  # [FIX] 메모리 안정성을 위해 동시성 감소 (16 → 4)
    # 결과 설정
    result_expires=3600,  # 결과 만료 시간 (1시간)
    # [NEW] 메모리 누수 방지 설정 (워커 재시작)
    worker_max_tasks_per_child=100,  # 100개 태스크 처리 후 워커 재시작
    worker_max_memory_per_child=300000,  # 300MB 초과 시 재시작 (KB 단위)
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


# [FIX] 워커 프로세스 초기화 시 DB 커넥션 풀 리셋
# Fork 방식 사용 시 부모 프로세스의 커넥션 풀을 상속받아 발생하는 충돌 방지
from celery.signals import worker_process_init  # noqa: E402


@worker_process_init.connect
def init_worker_process(**kwargs):
    """
    워커 프로세스(자식)가 생성될 때 실행됩니다.
    1. .env 환경 변수를 다시 로드 (override=True)
    2. 상속받은 SQL Engine의 커넥션 풀 폐기 (DB 연결 초기화)
    """
    import os
    from pathlib import Path

    # 1. 환경 변수 다시 로드 (설정 리로드)
    try:
        from dotenv import load_dotenv

        # moduly 루트 디렉토리 찾기 (현재 파일: apps/shared/celery_app.py)
        # ../../.env
        current_dir = Path(__file__).resolve().parent
        root_dir = current_dir.parent.parent
        env_path = root_dir / ".env"

        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=True)
            print(f"Worker process ({os.getpid()}): .env reloaded.")
    except ImportError:
        pass

    # 2. DB 연결 초기화
    from apps.shared.db.session import engine

    # 기존 커넥션 풀 폐기 (연결 종료가 아니라 풀 객체만 리셋)
    engine.dispose()
    print(
        f"Worker process initialized. (PID: {os.getpid()}) - DB Engine disposed, Config checked."
    )
