"""헬스 체크 엔드포인트"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Log System 헬스 체크"""
    return {"status": "healthy", "service": "log-system"}
