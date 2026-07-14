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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .tool import Tool
    from .user import User

# Tables:
# - resevations (id, tool_id, borrower_id, pickup_notes, return_notes, start_date, end_date, status, created_at)

# Views:
# - reservations_v (reservation_id, status, start_date, end_date, pickup_notes, return_notes, created_at, tool_id,
# tool_title, tool_description, tool_condition, tool_type_id, tool_type_code, tool_type_name, borrower_id,
# borrower_first_name, borrower_last_name, borrower_middle_name, owner_id, owner_first_name, owner_last_name,
# owner_middle_name, tool_photos)


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


class ReservationView(Base):
    __tablename__ = "reservations_v"

    reservation_id = Column(UUID(as_uuid=True), primary_key=True)
    reservation_status = Column(String)
    reservation_start_date = Column(DateTime(timezone=True))
    reservation_end_date = Column(DateTime(timezone=True))
    # Could be not the same as in tools table
    reservation_pickup_notes = Column(Text, nullable=True)
    # Could be not the same as in tools table
    reservation_return_notes = Column(Text, nullable=True)
    reservation_created_at = Column(DateTime(timezone=True))
    tool_id = Column(UUID(as_uuid=True))
    tool_title = Column(String)
    tool_description = Column(String)
    tool_condition = Column(String)
    tool_type_id = Column(Integer)
    tool_type_code = Column(String)
    tool_type_name = Column(String)
    borrower_id = Column(UUID(as_uuid=True))
    borrower_first_name = Column(String)
    borrower_last_name = Column(String)
    borrower_middle_name = Column(String, nullable=True)
    owner_id = Column(UUID(as_uuid=True))
    owner_first_name = Column(String)
    owner_last_name = Column(String)
    owner_middle_name = Column(String, nullable=True)
    tool_photos = Column(JSONB)
