"""merge multiple heads

Revision ID: 8a59117d5cc6
Revises: 136b2a22fa9d, e8c84b3977d7
Create Date: 2026-08-02 01:14:05.238993

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "8a59117d5cc6"
down_revision: Union[str, Sequence[str], None] = ("136b2a22fa9d", "e8c84b3977d7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
