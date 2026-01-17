"""
Gateway 서비스 Lifespan 관리
- DB 초기화
- LLM 프로바이더 시드
- SchedulerService 초기화
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

logger = logging.getLogger(__name__)

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
    # 1. 시작 로직: pgvector 확장 활성화
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=engine)

    # 2. 기본 LLM 프로바이더 시드 (멱등성 보장)
    from apps.shared.db.session import SessionLocal

    db = SessionLocal()
    try:
        # 2.1 플레이스홀더 사용자 시드 (개발 환경 필수)
        seed_placeholder_user(db)

        # 2.2 프로바이더 시드
        seed_default_llm_providers(db)

        # 2.3 기본 모델 시드
        seed_default_llm_models(db)

        # 2.4 기존 모델 가격 동기화 (KNOWN_MODEL_PRICES 기반)
        from apps.gateway.services.llm_service import LLMService

        result = LLMService.sync_system_prices(db)
        if result["updated_models"] > 0:
            logger.info(
                f"기존 모델 {result['updated_models']}개의 가격 정보 업데이트 완료"
            )

        # 2.5 SchedulerService 초기화 (스케줄러 시작)
        from apps.gateway.services.scheduler_service import init_scheduler_service

        logger.info("SchedulerService 초기화 중...")
        init_scheduler_service(db)
        logger.info("SchedulerService 초기화 완료")

    except Exception as e:
        logger.error(f"시드 데이터 생성 실패: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()

    yield

    # 종료 로직

    # SchedulerService 종료
    from apps.gateway.services.scheduler_service import get_scheduler_service

    try:
        scheduler = get_scheduler_service()
        scheduler.shutdown()
    except Exception as e:
        logger.error(f"SchedulerService 종료 실패: {e}")
