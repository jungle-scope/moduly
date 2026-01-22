"""
Sandbox API v1 Package
"""
from fastapi import APIRouter

from apps.sandbox.api.v1.endpoints import execute


api_router = APIRouter()
api_router.include_router(execute.router, prefix="/sandbox", tags=["sandbox"])
