import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationCategory
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservation import APP_TIMEZONE


def create_notification(
    db: Session,
    recipient_id: uuid.UUID,
    category: NotificationCategory,
    title: str,
    content: str,
    target_id: uuid.UUID | None = None,
    target_type: str | None = None,
) -> Notification:
    """
    Creates a notification instance and add it to the database without committing.
    Use db.commit() to save the changes.
    """
    notification = Notification(
        recipient_id=recipient_id,
        category=category,
        title=title,
        content=content,
        target_id=target_id,
        target_type=target_type,
    )
    db.add(notification)
    return notification


def run_daily_reservation_reminders(db: Session):
    """
    Scans for upcoming pickups and returns reservations within the next 24 hours
    and creates notifications.
    """
    now = datetime.now(timezone.utc)
    next_24h = now + timedelta(hours=24)

    # Pickup reminders (APPROVED status & start_date in the next 24 hours)
    upcoming_pickups = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_date >= now,
                Reservation.start_date <= next_24h,
            )
        )
        .all()
    )

    for reservation in upcoming_pickups:
        # Convert start_date to local timezone if needed, or format directly
        pickup_time_str = reservation.start_date.astimezone(APP_TIMEZONE).strftime(
            "%b %d"
        )

        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Tool pickup reminder",
            content=(
                f"Your reservation for '{reservation.tool.title}' is scheduled "
                f"to be picked up on {pickup_time_str}."
            ),
            target_id=reservation.id,
            target_type="RESERVATION",
        )

    # Return reminders (PICKED_UP status & end_date in the next 24 hours)
    upcoming_returns = (
        db.query(Reservation)
        .filter(
            and_(
                Reservation.status == ReservationStatus.PICKED_UP,
                Reservation.end_date >= now,
                Reservation.end_date <= next_24h,
            )
        )
        .all()
    )

    for reservation in upcoming_returns:
        return_time_str = reservation.end_date.astimezone(APP_TIMEZONE).strftime(
            "%b %d before %I:%M %p"
        )
        create_notification(
            db=db,
            recipient_id=reservation.borrower_id,
            category=NotificationCategory.RESERVATION,
            title="Tool return reminder",
            content=(
                f"Your reservation for '{reservation.tool.title}' is due "
                f"for return on {return_time_str}."
            ),
            target_id=reservation.id,
            target_type="RESERVATION",
        )

    db.commit()
