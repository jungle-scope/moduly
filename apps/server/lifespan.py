from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from apps.shared.db.base import Base
from apps.shared.db.models.schedule import Schedule  # noqa: F401
from apps.shared.db.seed import (
    seed_default_llm_models,
    seed_default_llm_providers,
    seed_placeholder_user,
)
from apps.shared.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 시작 로직

    # LogWorkerPool 초기화 (가장 먼저 시작)
    from workflow.core.log_worker_pool import (
        init_log_worker_pool,
        shutdown_log_worker_pool,
    )

    init_log_worker_pool()  # 환경변수 LOG_WORKER_COUNT, LOG_QUEUE_SIZE로 설정 가능
    print("[시작] LogWorkerPool 초기화 완료")

    # pgvector 확장 활성화
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=engine)
    print("데이터베이스 테이블 생성 완료")

    # 2. 기본 LLM 프로바이더 시드 (멱등성 보장)

    from db.session import SessionLocal

    db = SessionLocal()
    try:
        # 2.1 플레이스홀더 사용자 시드 (개발 환경 필수)
        seed_placeholder_user(db)

        # 2.2 프로바이더 시드
        seed_default_llm_providers(db)

        # 2.3 기본 모델 시드
        seed_default_llm_models(db)

        # 2.4 기존 모델 가격 동기화 (KNOWN_MODEL_PRICES 기반)
        from services.llm_service import LLMService

        result = LLMService.sync_system_prices(db)
        if result["updated_models"] > 0:
            print(f"기존 모델 {result['updated_models']}개의 가격 정보 업데이트 완료")

        # 2.5 SchedulerService 초기화 (스케줄러 시작)
        from services.scheduler_service import init_scheduler_service

        print("SchedulerService 초기화 중...")
        init_scheduler_service(db)
        print("SchedulerService 초기화 완료")

    except Exception as e:
        print(f"시드 데이터 생성 실패: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()

    yield

    # 종료 로직

    # LogWorkerPool 종료 (SchedulerService보다 나중에 종료)
    shutdown_log_worker_pool()
    print("[종료] LogWorkerPool 종료 완료")

    # SchedulerService 종료
    from services.scheduler_service import get_scheduler_service

    try:
        scheduler = get_scheduler_service()
        scheduler.shutdown()
    except Exception as e:
        print(f"SchedulerService 종료 실패: {e}")
