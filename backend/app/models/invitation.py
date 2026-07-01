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

INVITATION_LINK_EXPIRE_DAYS = 7  # User story 11

# Tables:
# - invitations (id, invitation_token, sender_id, recipient_email, recipient_id, status, created_at, expires_at)

# Views:
#


class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "USED"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class Invitation(Base):
    __tablename__ = "invitations"

    __table_args__ = {
        "comment": "Table for tracking peer-to-peer neighborhood registration tokens used to control application access"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for an invitation",
    )
    invitation_token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        comment="The secure random string sent via email",
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the invitation to the existing user who sent the invite link",
    )
    recipient_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Target email address the invite was sent to",
    )
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        comment="Links the invitation to a new user profile created via this invite",
    )
    status: Mapped[InvitationStatus] = mapped_column(
        SAEnum(InvitationStatus, native_enum=False),
        default=InvitationStatus.PENDING,
        server_default=text("'PENDING'"),  # Keeps the DB server fallback safe
        nullable=False,
        comment="The status of the invite token",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the invite link was created",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.timezone("UTC", func.now())
        + text(f"INTERVAL '{INVITATION_LINK_EXPIRE_DAYS} days'"),
        comment="Date and time the invite link is expired",
    )

    # Relationships: invitation.
    sender: Mapped["User"] = relationship(
        "User", foreign_keys=[sender_id], back_populates="sent_invitations"
    )
    recipient: Mapped["User | None"] = relationship(
        "User", foreign_keys=[recipient_id], back_populates="received_invitations"
    )
