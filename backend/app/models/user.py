import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .photo import Photo


class UserRole(Base):
    __tablename__ = "user_roles"

    __table_args__ = {"comment": "Lookup table defining user access levels"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the role",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment='Uppercase code name (e.g., "USER", "ADMIN")',
    )
    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Human-readable role name for UI display"
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Explanation of permissions assigned to the role"
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


class UserStatus(Base):
    __tablename__ = "user_statuses"

    __table_args__ = {"comment": "Lookup table defining user account status"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the account status",
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment='Uppercase code name (e.g., "ACTIVE", "SUSPENDED")',
    )
    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Human-readable status name for UI display"
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation of what limitations the user status has",
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="status")


class User(Base):
    __tablename__ = "users"

    __table_args__ = {
        "comment": "Table for user profiles, authentication credentials, and account settings"
    }

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for each user",
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Full name of the user"
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        comment="User's unique email address used for system login",
    )
    password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Securely hashed password string"
    )
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Brief personal bio or introduction written by the user",
    )
    location: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="General neighborhood or street location"
    )
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id"),
        unique=True,
        nullable=True,
        comment="Links the user to the user's uploaded profile picture",
    )
    status_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_statuses.id"),
        nullable=False,
        comment="Links the user to their account status",
    )
    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_roles.id"),
        nullable=False,
        comment="Links the user to their system role",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        comment="Date and time the user account was created",
    )

    photo: Mapped["Photo | None"] = relationship("Photo", back_populates="user")
    role: Mapped["UserRole"] = relationship("UserRole", back_populates="users")
    status: Mapped["UserStatus"] = relationship("UserStatus", back_populates="users")
