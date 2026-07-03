import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .user import User


class Photo(Base):
    __tablename__ = "photos"

    __table_args__ = {
        "comment": "Table for storing unique URLs for uploaded images (profile photo, tool photos)"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique identifier for a image",
    )
    url: Mapped[str] = mapped_column(
        Text, nullable=False, comment="The address hosting the actual image file"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the image was added",
    )

    # Relationship: photo.
    user: Mapped["User | None"] = relationship("User", back_populates="photo")
