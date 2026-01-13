"""
Workflow Engine - FastAPI App
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Workflow Engine] 서비스 시작")
    yield
    print("[Workflow Engine] 서비스 종료")

app = FastAPI(
    title="Moduly Workflow Engine",
    description="워크플로우 실행 엔진 서비스",
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

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy", "service": "workflow-engine"}
