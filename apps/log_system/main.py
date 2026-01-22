"""
Moduly Log System

워크플로우 실행 로그 수집 및 저장을 담당하는 마이크로서비스입니다.
Celery Worker로 동작하며, 비동기로 로그를 DB에 저장합니다.

실행 방법:
    celery -A apps.log_system.main worker -Q log -l info
"""

import logging
import os
import sys

# ===================================================
# 로깅 설정 (Celery Worker 시작 전 )
# ===================================================
# Python 표준 logger (logger.info, logger.error 등)가
# stdout으로 출력되도록 설정 → Promtail이 수집 → Loki로 전송
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from dotenv import load_dotenv

# 환경변수 로드 (프로젝트 루트의 .env)
env_path = os.path.join(PROJECT_ROOT, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # fallback to default
    load_dotenv()

# Celery 앱 import (tasks 모듈이 자동으로 등록됨)
from apps.log_system import tasks  # noqa: F401 - Celery 태스크 등록
from apps.shared.celery_app import celery_app

# Celery 앱 export
app = celery_app
