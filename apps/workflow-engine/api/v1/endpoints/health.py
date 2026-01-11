"""
Health Check 엔드포인트
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "workflow-engine"}
