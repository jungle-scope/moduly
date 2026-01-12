"""
Workflow Engine 마이크로서비스

워크플로우 그래프 실행, 노드 처리, SSE 스트리밍을 담당합니다.
Gateway 서비스를 통해서만 접근 가능합니다.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# shared 패키지 경로 추가
APPS_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(Path(__file__).parent))  # 현재 디렉토리 (workflow-engine)
sys.path.insert(0, str(APPS_DIR / "shared"))

# .env 로드 (로컬 또는 프로젝트 루트) - 다른 모듈 임포트 전에 수행
LOCAL_ENV_PATH = Path(__file__).parent / ".env"
ROOT_ENV_PATH = APPS_DIR.parent / ".env"

if LOCAL_ENV_PATH.exists():
    env_path = LOCAL_ENV_PATH
elif ROOT_ENV_PATH.exists():
    env_path = ROOT_ENV_PATH
else:
    env_path = None

if env_path and env_path.exists():
    load_dotenv(env_path)
    print(f"[WorkflowEngine] Loading .env from {env_path}")
    db_name = os.getenv("DB_NAME", "Not Set")
    print(f"[WorkflowEngine] DB_NAME: {db_name}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from lifespan import lifespan

app = FastAPI(
    title="Workflow Engine",
    description="워크플로우 실행 전용 마이크로서비스",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 (내부 서비스이므로 제한적)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
from api.v1.endpoints import execute, health

app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(execute.router, prefix="/internal", tags=["Execute"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
