"""
Notification routers.
Handles viewing and updating notifications.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import DetailError, MessageResponse
from app.schemas.notification import NotificationResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    response_model=list[NotificationResponse],
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_my_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve user notifications.
    """
    # Initialize query context pointed at the notification view for the current user
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712

    notifications = (
        query.order_by(Notification.created_at.desc()).limit(limit).offset(offset).all()
    )

    return notifications


@router.get(
    "/unread-count",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get unread notification count for frontend headers/navbars.
    """
    count = (
        db.scalar(
            db.query(func.count()).where(
                Notification.recipient_id == current_user.id,
                Notification.is_read == False,  # noqa: E712
            )
        )
        or 0
    )
    return {"unread_count": count}


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark a single notification as read.
    """
    # Fetch the notification entity
    notification = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification record not found.",
        )

    # Mark the notification as read
    notification.is_read = True
    try:
        db.commit()
        db.refresh(notification)
    except Exception as e:
        print(f"Error updating notification: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification.",
        )

    return notification


@router.post(
    "/read-all",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def mark_all_notification_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark all current user notifications as read.
    """
    # Mark all notifications as read
    try:
        db.query(Notification).filter(
            Notification.recipient_id == current_user.id
        ).update({"is_read": True})
        db.commit()
    except Exception as e:
        print(f"Error updating notifications: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notifications.",
        )

    return {"message": "Notifications marked as read."}
