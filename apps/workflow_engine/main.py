"""
Workflow-Engine Celery 앱 설정
"""

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# ===================================================
# [CRITICAL] Gevent Monkey Patching (Selective)
# ===================================================
# gevent pool 사용 시 asyncio와의 호환성을 위해 필요하지만,
# macOS에서 solo pool과 함께 사용 시 asyncio 루프와 충돌하여 데드락 유발.
if any(arg.startswith("--pool=gevent") or arg == "-P gevent" for arg in sys.argv):
    from gevent import monkey

    monkey.patch_all()
    print("[Workflow-Engine] Gevent pool detected. Monkey patching applied.")
else:
    print(
        "[Workflow-Engine] Non-gevent pool or local environment. Skipping monkey patch."
    )

# ===================================================
# 로깅 및 환경 변수 설정
# ===================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=False)

# Celery 앱 및 태스크 로드 (몽키 패치 이후에 안전하게 임포트)
from apps.shared.celery_app import celery_app
from apps.workflow_engine import tasks  # noqa: F401

__all__ = ["celery_app"]
