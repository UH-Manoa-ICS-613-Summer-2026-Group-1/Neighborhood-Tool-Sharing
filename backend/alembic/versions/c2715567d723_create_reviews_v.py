"""Create reviews_v

Revision ID: c2715567d723
Revises: 49bf7492ea4d
Create Date: 2026-07-21 05:04:26.026073

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2715567d723"
down_revision: Union[str, Sequence[str], None] = "49bf7492ea4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create reviews view

    # Path to the create_reviews_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_reviews_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the reviews view
    op.execute(sa.text("DROP VIEW IF EXISTS reviews_v;"))
