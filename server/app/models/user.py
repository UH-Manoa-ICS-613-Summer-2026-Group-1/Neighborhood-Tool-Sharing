import enum
import uuid
from datetime import datetime
from sqlalchemy import Enum as SAEnum, Text, DateTime, func, UUID, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)   
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, native_enum=False),
        default=UserStatus.ACTIVE,
        nullable=False
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False),
        default=UserRole.USER,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.now(), 
        nullable=False
    )