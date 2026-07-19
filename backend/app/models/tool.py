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
    from .photo import Photo
    from .reservation import Reservation
    from .user import User

DEFAULT_LOAN_DURATION_LIMIT = 7

# Tables:
# - tool_types (id, code, display_name, description)
# - tools (id, owner_id, tool_type_id, title, description, condition, pickup_notes, return_notes, loan_duration_limit, status, created_at)

# Views:
# - tools_v (id, owner_id, tool_type_id, tool_type_code, tool_type_name,
# title, description, condition, pickup_notes, return_notes, loan_duration_limit, status, created_at, tool_photos)


class ToolCondition(str, enum.Enum):
    NEW = "NEW"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"


class ToolStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    HIDDEN = "HIDDEN"
    DELETED = "DELETED"
    SUSPENDED = "SUSPENDED"


class ToolType(Base):
    __tablename__ = "tool_types"

    __table_args__ = {
        "comment": "Lookup table classifying equipment into searchable categories (e.g., Power Tools, Gardening)."
    }

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the tool type",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment='Uppercase code name of the tool category (e.g., "POWER_TOOLS")',
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Human-readable tool category for UI display",
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Explanation of what belongs in this category"
    )

    tools: Mapped[list["Tool"]] = relationship("Tool", back_populates="tool_type")


class Tool(Base):
    __tablename__ = "tools"

    __table_args__ = {
        "comment": "Table for storing all registered tools by owners for community sharing"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a tool",
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the tool to the user who owns and shares the tool",
    )
    tool_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tool_types.id"),
        nullable=False,
        comment="Links the tool to the tool category",
    )
    title: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Name of the tool provided by the owner"
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Details description of the tool provided by the owner",
    )
    condition: Mapped[ToolCondition] = mapped_column(
        SAEnum(ToolCondition, native_enum=False),
        nullable=False,
        comment="The condition of the tool provided by the owner",
    )
    pickup_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Instructions for picking up the tool"
    )
    return_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Instructions for returning the tool"
    )
    loan_duration_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=DEFAULT_LOAN_DURATION_LIMIT,
        server_default=text(str(DEFAULT_LOAN_DURATION_LIMIT)),
        comment="Maximum continuous days the user can request the tool",
    )
    status: Mapped[ToolStatus] = mapped_column(
        SAEnum(ToolStatus, native_enum=False),
        nullable=False,
        default=ToolStatus.AVAILABLE,
        server_default=text("'AVAILABLE'"),
        comment="The current status of the tool",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the tool was added",
    )

    # Relationships: tool.

    owner: Mapped["User"] = relationship("User", back_populates="tools")
    tool_type: Mapped["ToolType"] = relationship("ToolType", back_populates="tools")
    photos: Mapped[list["Photo"]] = relationship(
        "Photo", secondary="tool_photos", back_populates="tools"
    )
    reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation", back_populates="tool"
    )


class ToolView(Base):
    __tablename__ = "tools_v"

    tool_id = Column(UUID(as_uuid=True), primary_key=True)
    owner_id = Column(UUID(as_uuid=True))
    owner_first_name = Column(String)
    owner_last_name = Column(String)
    owner_middle_name = Column(String, nullable=True)
    tool_type_id = Column(Integer)
    tool_type_code = Column(String)
    tool_type_name = Column(String)
    tool_title = Column(String)
    tool_description = Column(String)
    tool_condition = Column(String)
    tool_pickup_notes = Column(String)
    tool_return_notes = Column(String)
    tool_loan_duration_limit = Column(Integer)
    tool_status = Column(String)
    tool_created_at = Column(DateTime)
    tool_photos = Column(JSONB)
