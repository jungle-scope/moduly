"""Add WEBHOOK and SCHEDULER to RunTriggerMode enum

Revision ID: d4e5f6g7h8i9
Revises: c35b8a436a9e
Create Date: 2026-01-22 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, Sequence[str], None] = 'c35b8a436a9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # PostgreSQL에서 ENUM 타입에 값을 추가할 때는 트랜잭션 밖에서 실행해야 함
    op.execute("COMMIT")
    op.execute("ALTER TYPE runtriggermode ADD VALUE IF NOT EXISTS 'WEBHOOK'")
    op.execute("ALTER TYPE runtriggermode ADD VALUE IF NOT EXISTS 'SCHEDULER'")
    op.execute("ALTER TYPE runtriggermode ADD VALUE IF NOT EXISTS 'APP'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
