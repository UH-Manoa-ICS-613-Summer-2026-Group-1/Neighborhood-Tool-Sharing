import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .reservation import Reservation
    from .user import User

# Tables:
# - reviews (id, reservation_id, reviewer_id, reviewee_id, rating, comment, created_at)

# Views:
# -


class Review(Base):
    __tablename__ = "reviews"

    __table_args__ = (
        # Add unique constraint that prevents duplicate reviews
        UniqueConstraint(
            "reservation_id", "reviewer_id", name="uq_reservation_reviewer"
        ),
        {
            "comment": "Table that store rating and feedback about reservation after it is completed",
        },
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        comment="Unique identifier for a review",
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the review to the reservation",
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the review to the user who submitted the review",
    )
    reviewee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Links the review to the user who received the review",
    )
    rating: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Review rating from 1 to 5"
    )
    comment: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Review comment provided by the reviewer"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.timezone("UTC", func.now()),
        nullable=False,
        comment="Date and time the reservation was created",
    )

    # Relationships: review.

    reservation: Mapped["Reservation"] = relationship(
        "Reservation", back_populates="reviews"
    )
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewer_id])
    reviewee: Mapped["User"] = relationship("User", foreign_keys=[reviewee_id])


class ReviewView(Base):
    __tablename__ = "reviews_v"

    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    reservation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    reviewer_first_name: Mapped[str] = mapped_column(String)
    reviewer_middle_name: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewer_last_name: Mapped[str] = mapped_column(String)
    reviewer_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)

    reviewee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    reviewee_first_name: Mapped[str] = mapped_column(String)
    reviewee_middle_name: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewee_last_name: Mapped[str] = mapped_column(String)
    reviewee_photo_url: Mapped[str | None] = mapped_column(String, nullable=True)

    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
