"""
Workflow-Engine Celery 앱 설정
"""

# [SY] Celery worker는 FastAPI와 달리 자동으로 .env를 로드하지 않음
# ENCRYPTION_KEY 등 환경 변수를 사용하기 위해 반드시 다른 import 전에 로드 필요
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# ===================================================
# 로깅 설정 (Celery Worker 시작 전)
# ===================================================
# Python 표준 logger (logger.info, logger.error 등)가
# stdout으로 출력되도록 설정 → Promtail이 수집 → Loki로 전송
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # moduly/
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=False)

from apps.shared.celery_app import celery_app

# Celery가 tasks 모듈을 인식하도록 import
from apps.workflow_engine import tasks  # noqa: F401

# Celery 앱을 apps.shared에서 재사용
__all__ = ["celery_app"]
