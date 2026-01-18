# .env 파일을 기본값으로 로드 ( 개발 환경 )
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# ===================================================
# 로깅 설정 (FastAPI 시작 전 )
# ===================================================
# Python 표준 logger (logger.info, logger.error 등)가
# stdout으로 출력되도록 설정 → Promtail이 수집 → Loki로 전송
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Get logger for this module
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent.parent  # moduly/

# moduly/.env 로드
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    logger.info(f"Loading .env from {ENV_PATH}")
    load_dotenv(dotenv_path=ENV_PATH, override=False)
else:
    logger.warning(f".env file not found at {ENV_PATH}")

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from apps.gateway.api.api import api_router
from apps.gateway.lifespan import lifespan  # Import lifespan from module

app = FastAPI(title="Moduly Gateway API", lifespan=lifespan)

origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = origins_str.split(",")

# CORS 설정 (withCredentials 지원)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # .env에서 CORS_ORIGINS로 설정 가능
    allow_credentials=True,  # 쿠키 전송 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션 미들웨어 추가 (OAuth 상태 저장용)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key-change-in-production"),
    https_only=os.getenv("NODE_ENV") == "production",  # 배포 환경에서는 Secure 쿠키
)

# 정적 파일 서빙 (widget.js) - 옵션
STATIC_DIR = BASE_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"status": "ok", "service": "gateway"}
