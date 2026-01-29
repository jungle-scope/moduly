"""update parsing_registry pk

Revision ID: a1b2c3d4e5f6
Revises: 4755334ea58d
Create Date: 2026-01-29 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "4755334ea58d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing primary key constraint
    op.drop_constraint("parsing_registry_pkey", "parsing_registry", type_="primary")
    # Create the new composite primary key
    op.create_primary_key(
        "parsing_registry_pkey", "parsing_registry", ["content_digest", "provider"]
    )


def downgrade() -> None:
    # Drop the composite primary key
    op.drop_constraint("parsing_registry_pkey", "parsing_registry", type_="primary")
    # Restore the original primary key
    op.create_primary_key(
        "parsing_registry_pkey", "parsing_registry", ["content_digest"]
    )
