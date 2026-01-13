"""
Gateway - FastAPI 앱

API 게이트웨이 역할을 담당합니다:
- 클라이언트 요청 라우팅
- 인증/인가
- 워크플로우 실행 요청을 Celery 태스크로 발행
- Redis Pub/Sub 구독을 통한 SSE 스트리밍
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from apps.gateway.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 코드"""
    # 시작 시
    print("[Gateway] 서비스 시작")
    yield
    # 종료 시
    print("[Gateway] 서비스 종료")


app = FastAPI(
    title="Moduly Gateway",
    description="API 게이트웨이 서비스",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션 미들웨어 (OAuth 상태 관리용)
SESSION_SECRET = os.getenv("SESSION_SECRET", "your-secret-key-change-in-production")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "service": "gateway"}
