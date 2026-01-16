"""
Workflow-Engine Celery 앱 설정
"""

# [SY] Celery worker는 FastAPI와 달리 자동으로 .env를 로드하지 않음
# ENCRYPTION_KEY 등 환경 변수를 사용하기 위해 반드시 다른 import 전에 로드 필요
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # moduly/
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=False)

from apps.shared.celery_app import celery_app

# Celery가 tasks 모듈을 인식하도록 import
from apps.workflow_engine import tasks  # noqa: F401

# Celery 앱을 apps.shared에서 재사용
__all__ = ["celery_app"]
