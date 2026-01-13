"""Gateway API v1 라우터"""
from fastapi import APIRouter

from apps.gateway.api.v1.endpoints import (
    health,
    auth,
    apps,
    workflows,
    deployments,
    run,
)

api_router = APIRouter()

# 헬스 체크
api_router.include_router(health.router, tags=["health"])

# 인증
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# 앱 관리
api_router.include_router(apps.router, prefix="/apps", tags=["apps"])

# 워크플로우 관리
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])

# 배포 관리
api_router.include_router(deployments.router, prefix="/deployments", tags=["deployments"])

# 워크플로우 실행
api_router.include_router(run.router, tags=["run"])
