"""Create user_profiles_v

Revision ID: 71f4b9017e5a
Revises: f9635f5bf9df
Create Date: 2026-07-01 06:35:00.403298

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "71f4b9017e5a"
down_revision: Union[str, Sequence[str], None] = "f9635f5bf9df"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user profile view

    # Path to the create_user_profiles_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_user_profiles_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the user profile view
    op.execute(sa.text("DROP VIEW IF EXISTS user_profiles_v;"))
