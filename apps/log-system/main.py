"""
Log System - FastAPI 앱

워크플로우 실행 로그 조회 API를 제공합니다.
실제 로그 저장은 Celery Worker가 처리합니다.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.log_system.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 코드"""
    # 시작 시
    print("[Log System] 서비스 시작")
    yield
    # 종료 시
    print("[Log System] 서비스 종료")


app = FastAPI(
    title="Moduly Log System",
    description="워크플로우 실행 로그 관리 서비스",
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

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "service": "log-system"}
