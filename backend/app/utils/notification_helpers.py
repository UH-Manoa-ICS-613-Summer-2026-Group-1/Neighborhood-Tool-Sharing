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
