"""
Workflow-Engine Celery 앱 설정
"""

from apps.shared.celery_app import celery_app

# Celery가 tasks 모듈을 인식하도록 import
from apps.workflow_engine import tasks  # noqa: F401

# Celery 앱을 apps.shared에서 재사용
__all__ = ["celery_app"]
