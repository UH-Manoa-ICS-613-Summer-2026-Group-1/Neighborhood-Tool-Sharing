"""Create_user_profile_view

Revision ID: db799141d79e
Revises: a8015845096e
Create Date: 2026-06-30 01:21:19.292737

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "db799141d79e"
down_revision: Union[str, Sequence[str], None] = "a8015845096e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user profile view

    # Path to the create_user_profiles_v.sql file in the views directory
    sql_path = (
        Path(__file__).resolve().parent
        / ".."
        / ".."
        / "sql"
        / "views"
        / "create_user_profiles_v.sql"
    )

    # Read and execute the file
    op.execute(sa.text(open(sql_path).read()))


def downgrade() -> None:
    # Drop the user profile view
    op.execute(sa.text("DROP VIEW IF EXISTS user_profiles_v;"))
