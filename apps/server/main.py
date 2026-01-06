from dotenv import load_dotenv

# .env 파일을 기본값으로 로드 (개발 환경)
# 배포 환경에서는 ECS Task Definition의 환경변수가 우선 적용됨
load_dotenv()

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from api.api import api_router
from db.base import Base
from db.seed import seed_default_llm_providers, seed_placeholder_user
from db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup Logic

    # pgvector 확장 활성화
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

    # 2. Seed Default LLM Providers (Idempotent)

    from db.session import SessionLocal

    db = SessionLocal()
    try:
        # 2.1 Seed Placeholder User (Critical for Dev)
        seed_placeholder_user(db)

        # 2.2 Seed Providers
        seed_default_llm_providers(db)

        # 2.3 Initialize SchedulerService (스케줄러 시작)
        from services.scheduler_service import init_scheduler_service

        print("🕐 SchedulerService 초기화 중...")
        init_scheduler_service(db)
        print("✅ SchedulerService 초기화 완료!")

    except Exception as e:
        print(f"⚠️ Failed to seed data: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()

    yield

    # Shutdown: SchedulerService 종료
    from services.scheduler_service import get_scheduler_service

    try:
        scheduler = get_scheduler_service()
        scheduler.shutdown()
    except Exception as e:
        print(f"⚠️ SchedulerService 종료 실패: {e}")


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

# 정적 파일 서빙 (widget.js)
app.mount("/static", StaticFiles(directory="static"), name="static")

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Moduly API Server !!!!!"}
