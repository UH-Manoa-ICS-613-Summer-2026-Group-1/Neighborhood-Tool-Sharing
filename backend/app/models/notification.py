import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
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

# Tables:
# - notification (id, recipient_id, category, title, content, target_id, target_type, is_read, created_at)

# Views:
# -


class NotificationCategory(str, enum.Enum):
    RESERVATION = "RESERVATION"
    MESSAGE = "MESSAGE"
    REPORT = "REPORT"
    REVIEW = "REVIEW"
    INVITATION = "INVITATION"
    SYSTEM = "SYSTEM"


class Notification(Base):
    __tablename__ = "notifications"

    # Add index for faster lookups
    __table_args__ = (
        Index(
            "idx_notifications_user_read_status",
            "recipient_id",
            "is_read",
            "created_at",
        ),
        {
            "comment": "Table for managing user notifications",
        },
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a notification",
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the notification to the user who received it",
    )
    category: Mapped[NotificationCategory] = mapped_column(
        SAEnum(NotificationCategory, native_enum=False),
        nullable=False,
        comment="Category of the notification",
        default=NotificationCategory.SYSTEM,
        server_default=text("SYSTEM"),
    )
    title: Mapped[str] = mapped_column(
        String(150), nullable=False, comment="Title of the notification"
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Content of the notification"
    )

    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, comment="Target id of the notification"
    )
    target_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Target type of the notification"
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Whether the notification is read",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the reservation was created",
    )

    # Relationships: notification.

    recipient: Mapped["User"] = relationship("User", back_populates="notifications")
