# .env 파일을 기본값으로 로드 (개발 환경) 
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# apps/gateway/.env 로드
GATEWAY_ENV_PATH = BASE_DIR / ".env"
if GATEWAY_ENV_PATH.exists():
    print(f"[Gateway] Loading .env from {GATEWAY_ENV_PATH}")
    load_dotenv(dotenv_path=GATEWAY_ENV_PATH)

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from api.api import api_router
from lifespan import lifespan

app = FastAPI(title="Moduly API Gateway", lifespan=lifespan)

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

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory="static"), name="static")

# API Router 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"status": "ok"}
