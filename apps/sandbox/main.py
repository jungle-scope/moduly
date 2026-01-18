"""
Sandbox Service - FastAPI Application
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from apps.sandbox.api.v1 import api_router
from apps.sandbox.core.scheduler import SandboxScheduler


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 라이프사이클 관리"""
    # Startup
    logger.info("Starting Sandbox Service...")
    scheduler = SandboxScheduler.get_instance()
    await scheduler.start()
    logger.info("Sandbox Service started")
    
    yield
    
    # Shutdown
    logger.info("Stopping Sandbox Service...")
    await scheduler.stop()
    logger.info("Sandbox Service stopped")


app = FastAPI(
    title="Moduly Sandbox Service",
    description="Secure Python code execution sandbox with NSJail",
    version="1.0.0",
    lifespan=lifespan,
)

# API 라우터 등록
app.include_router(api_router, prefix="/v1")


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "service": "Moduly Sandbox",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    """헬스 체크 (K8s용)"""
    scheduler = SandboxScheduler.get_instance()
    return {
        "status": "healthy",
        "queue_size": scheduler.queue_size,
    }
