from fastapi import APIRouter

from api.v1.endpoints import (
    app,
    auth,
    deployment,
    health,
    knowledge,
    llm,
    rag,
    run,
    webhook,
    workflow,
)

# 메인 API 라우터 생성
api_router = APIRouter()

# Health Check (독립 엔드포인트)
api_router.include_router(health.router, tags=["health"])

# 워크플로우 엔드포인트 등록
# /workflows 경로에 workflow.router의 모든 엔드포인트 추가
api_router.include_router(workflow.router, prefix="/workflows", tags=["workflows"])

# 앱 엔드포인트 등록
api_router.include_router(app.router, prefix="/apps", tags=["apps"])

# 추가 엔드포인트가 있다면 여기에 계속 등록
# 예: api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])

# Knowledge & RAG (Dev A)
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])

# Deployment & Run (Dev B)
api_router.include_router(
    deployment.router, prefix="/deployments", tags=["deployments"]
)
api_router.include_router(run.router, tags=["run"])

# Webhook (External Trigger)
api_router.include_router(webhook.router, tags=["webhook"])
