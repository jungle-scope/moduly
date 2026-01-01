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

from db.models.llm import LLMProvider


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup Logic

    # pgvector 확장 활성화
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

    # 2. Seed Default LLM Providers (Idempotent)
    import uuid

    from db.models.user import User
    from db.session import SessionLocal

    db = SessionLocal()
    try:
        # 2.1 Seed Placeholder User (Critical for Dev)
        # Match LLMService.PLACEHOLDER_USER_ID
        PLACEHOLDER_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")
        user = db.query(User).filter(User.id == PLACEHOLDER_ID).first()
        if not user:
            print("👤 Seeding placeholder user...")
            dev_user = User(
                id=PLACEHOLDER_ID,
                email="dev@moduly.app",
                name="Dev User",
                password="dev-password",
            )
            db.add(dev_user)
            db.commit()
            print("✅ Placeholder user created!")

        # 2.2 Seed Providers
        existing_count = db.query(LLMProvider).count()
        if existing_count == 0:
            print("🌱 Seeding default LLM providers...")
            default_providers = [
                LLMProvider(
                    name="openai",
                    description="OpenAI default provider",
                    base_url="https://api.openai.com/v1",
                    type="system",
                    auth_type="api_key",
                    doc_url="https://platform.openai.com/api-keys",
                ),
                LLMProvider(
                    name="anthropic",
                    description="Anthropic Claude provider",
                    base_url="https://api.anthropic.com/v1",
                    type="system",
                    auth_type="api_key",
                    doc_url="https://console.anthropic.com/settings/keys",
                ),
                LLMProvider(
                    name="google",
                    description="Google Gemini provider",
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai",  # OpenAI compatibility endpoint
                    type="system",
                    auth_type="api_key",  # Added missing auth_type
                    doc_url="https://aistudio.google.com/",
                ),
            ]
            db.add_all(default_providers)
            db.commit()
            print("✅ Default LLM providers seeded!")
        else:
            print(f"ℹ️ LLM providers already exist ({existing_count}). Skipping seed.")

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
