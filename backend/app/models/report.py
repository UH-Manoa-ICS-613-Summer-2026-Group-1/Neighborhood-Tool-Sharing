import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
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


class ReportStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"


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

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Category of the report",
        default="OTHER",
        server_default=text("'OTHER'"),
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Content of the report"
    )

    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="Target id of the report"
    )
    target_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Target type of the report"
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
