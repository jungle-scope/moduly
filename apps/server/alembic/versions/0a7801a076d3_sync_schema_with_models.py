"""Sync schema with models

Revision ID: 0a7801a076d3
Revises: dca23fe4ef31
Create Date: 2026-01-07 22:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0a7801a076d3"
down_revision: Union[str, None] = "dca23fe4ef31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Sync database schema with model definitions:
    1. documents.source_type: VARCHAR(50) → ENUM
    2. documents.updated_at: nullable → NOT NULL
    3. llm_usage_logs.workflow_run_id: 컬럼 추가
    """

    # ========== 1. documents.source_type: VARCHAR → ENUM ==========
    print("📝 Dropping existing sourcetype ENUM (if exists)...")
    # ⭐ 기존 ENUM 삭제 (이전 실패로 남아있을 수 있음)
    op.execute("DROP TYPE IF EXISTS sourcetype CASCADE")

    print("📝 Creating sourcetype ENUM...")
    # ⭐ ENUM 새로 생성 (SQLAlchemy 대신 직접 SQL)
    op.execute("""
        CREATE TYPE sourcetype AS ENUM ('FILE', 'API', 'DB')
    """)

    print("🔧 Removing DEFAULT from source_type...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        DROP DEFAULT
    """)

    print("🔄 Converting documents.source_type to ENUM...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        TYPE sourcetype 
        USING source_type::sourcetype
    """)

    print("✅ Setting DEFAULT back to 'FILE'...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        SET DEFAULT 'FILE'::sourcetype
    """)

    # ========== 2. documents.updated_at: NULL → NOT NULL ==========
    print("🔧 Filling NULL values in documents.updated_at...")
    op.execute("""
        UPDATE documents 
        SET updated_at = COALESCE(updated_at, created_at, NOW())
        WHERE updated_at IS NULL
    """)

    print("✅ Making documents.updated_at NOT NULL...")
    op.alter_column(
        "documents",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        existing_server_default=sa.text("now()"),
    )

    # ========== 3. llm_usage_logs.workflow_run_id 추가 ==========
    print("➕ Adding llm_usage_logs.workflow_run_id column...")
    op.add_column(
        "llm_usage_logs", sa.Column("workflow_run_id", sa.UUID(), nullable=True)
    )

    print("🔗 Creating foreign key constraint...")
    op.create_foreign_key(
        "fk_llm_usage_logs_workflow_run_id",
        "llm_usage_logs",
        "workflow_runs",
        ["workflow_run_id"],
        ["id"],
        ondelete="CASCADE",
    )

    print("✅ Schema sync completed!")


def downgrade() -> None:
    """
    Revert schema changes
    """

    # ========== 1. workflow_run_id 제거 ==========
    print("🔗 Dropping foreign key constraint...")
    op.drop_constraint(
        "fk_llm_usage_logs_workflow_run_id", "llm_usage_logs", type_="foreignkey"
    )

    print("➖ Dropping llm_usage_logs.workflow_run_id column...")
    op.drop_column("llm_usage_logs", "workflow_run_id")

    # ========== 2. updated_at → nullable ==========
    print("🔧 Making documents.updated_at nullable...")
    op.alter_column(
        "documents",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )

    # ========== 3. source_type:  ENUM → VARCHAR ==========
    print("🔧 Removing DEFAULT from source_type...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        DROP DEFAULT
    """)

    print("🔄 Converting documents.source_type back to VARCHAR...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        TYPE VARCHAR(50) 
        USING source_type::text
    """)

    print("✅ Setting DEFAULT back to 'FILE'...")
    op.execute("""
        ALTER TABLE documents 
        ALTER COLUMN source_type 
        SET DEFAULT 'FILE'
    """)

    print("🗑️ Dropping sourcetype ENUM...")
    op.execute("DROP TYPE IF EXISTS sourcetype")

    print("✅ Downgrade completed!")
