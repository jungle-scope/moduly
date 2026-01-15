"""
Shared 데이터베이스 모델 패키지

모든 SQLAlchemy 모델을 import하여 relationship이 올바르게 해결되도록 합니다.
Celery Worker에서 모델을 import할 때 순서 문제를 방지합니다.
"""

# User 모델 먼저 import (다른 모델에서 참조)
# 나머지 모델 import
from apps.shared.db.models.app import App
from apps.shared.db.models.connection import Connection
from apps.shared.db.models.knowledge import Document, KnowledgeBase
from apps.shared.db.models.llm import (
    LLMCredential,
    LLMModel,
    LLMProvider,
    LLMRelCredentialModel,
    LLMUsageLog,
)
from apps.shared.db.models.schedule import Schedule
from apps.shared.db.models.user import User
from apps.shared.db.models.workflow import Workflow
from apps.shared.db.models.workflow_deployment import WorkflowDeployment
from apps.shared.db.models.workflow_run import WorkflowNodeRun, WorkflowRun

__all__ = [
    "User",
    "App",
    "Connection",
    "Document",
    "KnowledgeBase",
    "LLMCredential",
    "LLMModel",
    "LLMProvider",
    "LLMRelCredentialModel",
    "LLMUsageLog",
    "Schedule",
    "Workflow",
    "WorkflowDeployment",
    "WorkflowNodeRun",
    "WorkflowRun",
]
