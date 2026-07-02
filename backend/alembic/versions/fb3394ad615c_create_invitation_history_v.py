"""Create invitation_history_v

Revision ID: fb3394ad615c
Revises: 76519d3d5daa
Create Date: 2026-07-02 01:53:55.572988

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5ca04af118a7"
down_revision: Union[str, Sequence[str], None] = "76519d3d5daa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create invitation history view

    # Path to the create_invitation_history_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_invitation_history_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the invitation history view
    op.execute(sa.text("DROP VIEW IF EXISTS invitation_history_v;"))
