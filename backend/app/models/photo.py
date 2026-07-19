import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, DateTime, ForeignKey, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .tool import Tool
    from .user import User


# Tables:
# - photos (id, url, created_at)
# - tool_photos (id, tool_id, photo_id)


class Photo(Base):
    __tablename__ = "photos"

    __table_args__ = {
        "comment": "Table for storing unique URLs for uploaded images (profile photo, tool photos)"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
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
    tools: Mapped[list["Tool"]] = relationship(
        "Tool", secondary="tool_photos", back_populates="photos"
    )


class ToolPhoto(Base):
    __tablename__ = "tool_photos"

    __table_args__ = {
        "comment": "Intersection table mapping multiple uploaded tool photo to individual tool"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a tool photo",
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tools.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the tool photo to the tool",
    )
    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the tool photo to the table where the photo is actually stored",
    )
