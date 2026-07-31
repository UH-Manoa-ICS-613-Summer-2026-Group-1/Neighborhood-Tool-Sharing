"""Create admin_overview_statistics_v

Revision ID: 136b2a22fa9d
Revises: 1420f6f97e79
Create Date: 2026-07-31 01:49:34.689114

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "136b2a22fa9d"
down_revision: Union[str, Sequence[str], None] = "1420f6f97e79"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create admin overview statistics view

    # Path to the create_admin_overview_statistics_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_admin_overview_statistics_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the admin overview statistics view
    op.execute(sa.text("DROP VIEW IF EXISTS admin_overview_statistics_v;"))
