# apps/server/alembic/env. py

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# 프로젝트 루트를 Python Path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# .env 파일 로드
from dotenv import load_dotenv

load_dotenv()

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 프로젝트의 Base와 모든 모델 import
from db.base import Base

# 모든 모델을 명시적으로 import (Alembic이 감지할 수 있도록)
from db.models.user import User
from db.models.app import App
from db.models.workflow import Workflow
from db.models.workflow_deployment import WorkflowDeployment
from db.models.workflow_run import WorkflowRun, WorkflowNodeRun
from db.models.llm import (
    LLMProvider,
    LLMModel,
    LLMCredential,
    LLMRelCredentialModel,
    LLMUsageLog,
    LegacyLLMProvider,
    LegacyLLMCredential,
)
from db.models.knowledge import KnowledgeBase, Document, DocumentChunk
from db.models.connection import Connection
from db.models.schedule import Schedule

# ⭐ 추가 모델이 있다면 여기에 import 추가
# from db.models.your_model import YourModel

# target_metadata 설정 (Alembic이 스키마 변경을 추적)
target_metadata = Base.metadata


def get_url():
    """환경변수에서 DB 연결 정보를 읽어 URL 생성"""
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "admin")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")
    DB_NAME = os.getenv("DB_NAME", "moduly")

    url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print(f"🔗 Database URL: postgresql://{DB_USER}:****@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
