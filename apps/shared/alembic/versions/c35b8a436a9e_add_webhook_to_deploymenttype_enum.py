"""Add WEBHOOK to DeploymentType enum

Revision ID: c35b8a436a9e
Revises: e4956fcd7e2b
Create Date: 2026-01-17 01:16:38.431390

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c35b8a436a9e'
down_revision: Union[str, Sequence[str], None] = 'e4956fcd7e2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # PostgreSQL에서 ENUM 타입에 값을 추가할 때는 트랜잭션 밖에서 실행해야 함
    op.execute("COMMIT")
    op.execute("ALTER TYPE deploymenttype ADD VALUE IF NOT EXISTS 'WEBHOOK'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
