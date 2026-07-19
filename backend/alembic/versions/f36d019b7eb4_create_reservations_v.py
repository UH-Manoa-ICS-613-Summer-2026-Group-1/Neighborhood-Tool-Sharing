"""Create reservations_v

Revision ID: f36d019b7eb4
Revises: 1af5d799b4ba
Create Date: 2026-07-13 21:41:40.443442

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f36d019b7eb4"
down_revision: Union[str, Sequence[str], None] = "1af5d799b4ba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create reservations view

    # Path to the create_reservations_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_reservations_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the reservations view
    op.execute(sa.text("DROP VIEW IF EXISTS reservations_v;"))
