import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
    String,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .user import User

RESET_LINK_EXPIRE_HOURS = 1  # User story 24

# Tables:
# - password_resets (id, user_id, reset_token, status, created_at, expires_at)

# Views:
# -


class PasswordResetStatus(str, enum.Enum):
    PENDING = "PENDING"
    USED = "USED"
    EXPIRED = "EXPIRED"


class PasswordReset(Base):
    __tablename__ = "password_resets"

    __table_args__ = {"comment": "Table for tracking password reset requests"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a password reset",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the password reset to the existing user",
    )
    reset_token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        comment="The secure random string sent via email",
    )
    status: Mapped[PasswordResetStatus] = mapped_column(
        SAEnum(PasswordResetStatus, native_enum=False),
        server_default=text("'PENDING'"),
        default=PasswordResetStatus.PENDING,
        nullable=False,
        comment="Status of the password reset request",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the password reset link was created",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.timezone("UTC", func.now())
        + text(f"INTERVAL '{RESET_LINK_EXPIRE_HOURS} HOURS'"),
        comment="Date and time the password reset link is expired",
    )

    # Relationship password_reset.
    user: Mapped["User"] = relationship("User", back_populates="password_resets")
