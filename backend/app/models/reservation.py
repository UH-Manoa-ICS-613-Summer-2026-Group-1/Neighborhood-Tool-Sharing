import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    Column,
    DateTime,
    ForeignKey,
    Integer,
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
    from .photo import Photo
    from .tool import Tool
    from .user import User

# Tables:
# -

# Views:
# -


class ReservationStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    PICKED_UP = "PICKED_UP"
    RETURNED = "RETURNED"
    DENIED = "DENIED"
    CANCELED = "CANCELED"


class Reservation(Base):
    __tablename__ = "reservations"

    __table_args__ = {
        "comment": "Table for managing the borrowing/lending cycle of tools"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a reservation",
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id"),
        nullable=False,
        comment="Links the reservation to the tool that involved in the borrowing/lending cycle",
    )
    borrower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the reservation to the user requesting the tool",
    )

    # The same attributes as in the tools table
    # The owner can modify these attributes independently from the tool loan notes
    pickup_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Instructions for picking up the tool"
    )
    return_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Instructions for returning the tool"
    )
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(ReservationStatus, native_enum=False),
        nullable=False,
        default=ReservationStatus.REQUESTED,
        server_default=text("'REQUESTED'"),
        comment="The current status of the reservation",
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Planned calendar reservation start date",
    )

    end_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Planned calendar reservation return date",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the reservation was created",
    )

    # Relationships: reservation.

    tool: Mapped["Tool"] = relationship("Tool", back_populates="reservations")
    borrower: Mapped["User"] = relationship(
        "User", foreign_keys=[borrower_id], back_populates="borrowed_reservations"
    )
