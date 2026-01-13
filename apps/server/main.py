# .env 파일을 기본값으로 로드 (개발 환경)
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent


# apps/.env도 로드 (OAuth 라이브러리 호환성)
APPS_ENV_PATH = BASE_DIR.parent / ".env"  # apps/.env
if APPS_ENV_PATH.exists():
    print(f"Loading .env from {APPS_ENV_PATH}")
    load_dotenv(dotenv_path=APPS_ENV_PATH, override=False)

# apps/server/.env 로드
SERVER_ENV_PATH = BASE_DIR / ".env"
if SERVER_ENV_PATH.exists():
    print(f"Loading .env from {SERVER_ENV_PATH}")
    load_dotenv(dotenv_path=SERVER_ENV_PATH)

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from api.api import api_router
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

    # Base.metadata.create_all(bind=engine)
    # print("데이터베이스 테이블 생성 완료")

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


app = FastAPI(title="Moduly API", lifespan=lifespan)

origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = origins_str.split(",")

# CORS 설정 (withCredentials 지원)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # .env에서 CORS_ORIGINS로 설정 가능
    allow_credentials=True,  # 쿠키 전송 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션 미들웨어 추가 (OAuth 상태 저장용)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key-change-in-production"),
    https_only=os.getenv("NODE_ENV") == "production",  # 배포 환경에서는 Secure 쿠키
)

# 정적 파일 서빙 (widget.js)
app.mount("/static", StaticFiles(directory="static"), name="static")

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"status": "ok"}
