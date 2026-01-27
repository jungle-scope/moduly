"""merge multiple heads

Revision ID: 2a28cca99a72
Revises: 69181176c936, d4e5f6g7h8i9
Create Date: 2026-01-23 17:33:49.639939

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a28cca99a72'
down_revision: Union[str, Sequence[str], None] = ('69181176c936', 'd4e5f6g7h8i9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
