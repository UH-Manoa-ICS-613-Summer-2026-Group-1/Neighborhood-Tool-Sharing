"""Add an exlude constrain that prevent overlaping active reservations

Revision ID: 3097c6e3e5a1
Revises: f36d019b7eb4
Create Date: 2026-07-15 08:58:50.766404

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3097c6e3e5a1"
down_revision: Union[str, Sequence[str], None] = "f36d019b7eb4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    op.execute("""
        ALTER TABLE reservations
        ADD CONSTRAINT no_overlapping_active_reservations
        EXCLUDE USING gist (
            tool_id WITH =,
            tstzrange(start_date, end_date) WITH &&
        )
        WHERE (status IN ('APPROVED', 'PICKED_UP'));
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        ALTER TABLE reservations
        DROP CONSTRAINT IF EXISTS no_overlapping_active_reservations;
    """)
