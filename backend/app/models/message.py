import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .reservation import Reservation
    from .user import User


class Message(Base):
    __tablename__ = "messages"

    __table_args__ = (
        Index("ix_messages_reservation_created", "reservation_id", "created_at"),
        {
            "comment": "Table for storing messages between users within a reservation",
        },
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for each message",
    )

    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the message to the reservation",
    )

    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the message to the user who sent it",
    )

    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Text content of the message"
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Whether the message is read",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the message was sent",
    )

    # Relationships message.
    reservation: Mapped["Reservation"] = relationship(
        "Reservation", back_populates="messages"
    )
    sender: Mapped["User"] = relationship("User", back_populates="sent_messages")
