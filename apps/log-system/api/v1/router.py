"""Log System API v1 라우터"""
from fastapi import APIRouter

from apps.log_system.api.v1.endpoints import logs, health

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
