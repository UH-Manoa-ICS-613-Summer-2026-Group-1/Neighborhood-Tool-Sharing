import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
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


class ReportStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"


class ReportTargetType(enum.Enum):
    RESERVATION = "RESERVATION"
    TOOL = "TOOL"
    USER = "USER"


class ReportCategory(enum.Enum):
    LATE_RETURN = "LATE_RETURN"
    TOOL_DAMAGED = "TOOL_DAMAGED"
    INAPPROPRIATE_BEHAVIOR = "INAPPROPRIATE_BEHAVIOR"
    OTHER = "OTHER"


class Report(Base):
    __tablename__ = "reports"

    __table_args__ = {
        "comment": "Table that contain records about user reports about a reservation, tool, or another user",
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for each report",
    )

    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="Links the report to the user who submitted the report",
    )

    category: Mapped[ReportCategory] = mapped_column(
        SAEnum(ReportCategory, native_enum=False),
        default=ReportCategory.OTHER,
        server_default=text("'OTHER'"),
        nullable=False,
        comment="Category of the report",
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Content of the report"
    )

    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="Target id of the report"
    )
    target_type: Mapped[ReportTargetType] = mapped_column(
        SAEnum(ReportTargetType, native_enum=False),
        nullable=False,
        comment="Target type of the report",
    )

    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus, native_enum=False),
        nullable=False,
        comment="Status of the report",
        default=ReportStatus.ACTIVE,
        server_default=text("'ACTIVE'"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the report was sent",
    )

    # Relationships report.
    reporter: Mapped["User"] = relationship(
        "User", back_populates="reports", foreign_keys=[reporter_id]
    )
