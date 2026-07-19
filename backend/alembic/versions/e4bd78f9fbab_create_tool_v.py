"""Create tool_v

Revision ID: e4bd78f9fbab
Revises: a6e5dc55557d
Create Date: 2026-07-09 04:20:44.550859

"""

from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4bd78f9fbab"
down_revision: Union[str, Sequence[str], None] = "a6e5dc55557d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tools view

    # Path to the tools_v.sql file in the views directory
    SQL_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "SQL"
        / "views"
        / "create_tools_v.sql"
    )

    # Read and execute the sql file
    with open(SQL_PATH, "r", encoding="utf-8") as f:
        op.execute(sa.text(f.read()))


def downgrade() -> None:
    # Drop the tools view
    op.execute(sa.text("DROP VIEW IF EXISTS tools_v;"))
