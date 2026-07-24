import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationCategory


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


def notify_reservation_status_change(
    db: Session,
    recipient_id: uuid.UUID,
    reservation_id: uuid.UUID,
    tool_name: str,
    new_status: str,
) -> Notification:
    """
    Helper for reservation status updates.
    """
    title = f"Reservation {new_status.title()}"
    content = f"Your reservation request for '{tool_name}' is now {new_status.upper()}."

    return create_notification(
        db=db,
        recipient_id=recipient_id,
        category=NotificationCategory.RESERVATION,
        title=title,
        content=content,
        target_id=reservation_id,
        target_type="RESERVATION",
    )
