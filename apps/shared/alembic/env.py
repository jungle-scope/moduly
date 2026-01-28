import os
import sys
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context

# 프로젝트 루트를 Python 경로에 추가 (apps.shared 모듈 import를 위해 필요)
# apps/shared/alembic/env.py → 프로젝트 루트는 3단계 상위
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
)
sys.path.insert(0, PROJECT_ROOT)

# .env 파일 로드
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# Alembic Config 객체
config = context.config

# Python 로깅 설정
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ========== 중요: SQLAlchemy Base 및 모델 임포트 ==========
# db.base 모듈을 찾기 위해 sys.path 설정이 선행되어야 함
from apps.shared.db.base import Base

# models/__init__.py에서 모든 모델을 한 번에 import
from apps.shared.db.models import (  # noqa: F401
    App,
    Connection,
    Document,
    DocumentChunk,
    KnowledgeBase,
    LLMCredential,
    LLMModel,
    LLMProvider,
    LLMRelCredentialModel,
    LLMUsageLog,
    ParsingRegistry,
    Schedule,
    User,
    Workflow,
    WorkflowDeployment,
    WorkflowNodeRun,
    WorkflowRun,
)

# 모든 모델을 임포트해야 Alembic이 테이블을 인식합니다

# MetaData 설정
target_metadata = Base.metadata

# ========== 환경변수에서 DATABASE_URL 구성 ==========
DB_HOST = os.getenv("DB_HOST", "localhost")
# macOS에서 localhost가 ::1로 잡히는 문제를 방지하기 위해 127.0.0.1로 강제
if DB_HOST == "localhost":
    DB_HOST = "127.0.0.1"

DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")
DB_NAME = os.getenv("DB_NAME", "moduly_local")

# 실제 연결할 DB 이름은 moduly_local이 될 수도 있으므로 .env 확인 필요
# 하지만 코드에서는 .env의 값을 그대로 사용
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# alembic.ini의 sqlalchemy.url을 동적으로 설정
config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    """오프라인 모드: SQL 스크립트만 생성 (실제 DB 연결 없음)"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """온라인 모드: DB에 직접 마이그레이션 적용"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # pgvector 지원을 위한 render_as_batch 비활성화 (PostgreSQL 특화 기능 사용 시 필요)
            render_as_batch=False,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
