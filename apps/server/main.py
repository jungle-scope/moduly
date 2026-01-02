from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from api.api import api_router
from db.base import Base
from db.session import engine

load_dotenv()  # .env 파일 로드


from contextlib import asynccontextmanager

from db.seed import seed_default_llm_providers, seed_placeholder_user


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

    except Exception as e:
        print(f"⚠️ Failed to seed data: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()

    yield
    # 3. Shutdown Logic (if any)


app = FastAPI(title="Moduly API", redirect_slashes=False, lifespan=lifespan)


# CORS 설정 (withCredentials 지원)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend 개발 서버
        "http://127.0.0.1:3000",
    ],
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
    return {"message": "Moduly API Server"}
