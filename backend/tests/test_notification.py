from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.notification import NotificationCategory
from app.models.reservation import ReservationStatus
from app.schemas.reservation import APP_TIMEZONE
from app.utils.notification_helpers import (
    create_notification,
    run_daily_reservation_reminders,
)
from sqlalchemy.orm import Session

today = (
    datetime.now(APP_TIMEZONE)
    .replace(hour=0, minute=0, second=0)
    .astimezone(ZoneInfo("UTC"))
)
tomorrow = today + timedelta(days=1)


# US 26 Scenario 1: Reminder before pickup
def test_reminder_before_pickup(
    db_session, client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that borrower receives a notification before picking up the tool.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # There are no notifications
    assert len(seed_user2.notifications) == 0

    # Set the reservation status to APPROVED that the reservation becomes active
    seed_reservation.status = ReservationStatus.APPROVED
    # Midify the start date from today to tomorrow. Now, the reservation strats tomorrow 00:00:00 and ends tomorrow 23:59:59
    # The user should receive a notification about the soon pickup
    seed_reservation.start_date = seed_reservation.start_date + timedelta(days=1)
    db_session.commit()

    # Run the reminder process whcih creates a notifications
    # Normally this process runs daily at 10:00 AM local time
    run_daily_reservation_reminders(db_session)

    # Hit show all notifications
    response = client.get("/api/notifications", headers=headers)
    assert response.status_code == 200

    # There are notifications
    notifications = response.json()
    assert len(seed_user2.notifications) == 1
    assert len(notifications) > 0

    # This notification is a reminder
    assert (
        notifications[0]["content"]
        == f"Your reservation for '{seed_reservation.tool.title}' is scheduled to be picked up on {seed_reservation.start_date.astimezone(APP_TIMEZONE).strftime('%b %d')}."
    )


def test_reminder_before_return(
    db_session, client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that borrower receives a notification before return the tool.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # There are no notifications
    assert len(seed_user2.notifications) == 0

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    # The end date of the seed reservtaion is tomorrow 23:59:59. It is more than 24 hours away
    # Set the end date to today 23:59:59
    seed_reservation.end_date = seed_reservation.end_date - timedelta(days=1)
    # The user should receive a notification about the soon return
    db_session.commit()

    # Run the reminder process whcih creates a notifications
    # Normally this process runs daily at 10:00 AM local time
    run_daily_reservation_reminders(db_session)

    # Hit show all notifications
    response = client.get("/api/notifications", headers=headers)
    assert response.status_code == 200

    # There are notifications
    notifications = response.json()
    assert len(seed_user2.notifications) == 1
    assert len(notifications) > 0

    # This notification is a reminder
    assert (
        notifications[0]["content"]
        == f"Your reservation for '{seed_reservation.tool.title}' is due for return on {seed_reservation.end_date.astimezone(APP_TIMEZONE).strftime('%b %d before %I:%M %p')}."
    )


def test_notification_after_create(
    client, seed_user, seed_user2, seed_tool, get_auth_headers
):
    """
    Test that a notification is sent to the owner after the reservation is created.
    """

    # seed_user is the owner
    # No notifications yet
    assert len(seed_user.notifications) == 0

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "start_date": str(today),
        "end_date": str(tomorrow),
    }

    # Hit create reservation
    response = client.post("/api/reservations", json=payload, headers=headers)

    assert response.status_code == 201

    # There is notification
    assert (
        seed_user.notifications[0].content
        == f"{seed_user2.first_name} {seed_user2.last_name} has requested to borrow your tool '{seed_tool.title}'."
    )


def test_notification_after_approve(
    client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a notification is sent to the borrower after the reservation is approved.
    """

    # seed_user2 is the borrower
    # No notifications yet
    assert len(seed_user2.notifications) == 0

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Hit approve reservation
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/approve", headers=headers
    )

    assert response.status_code == 200

    # There is approve notification
    assert (
        seed_user2.notifications[0].content
        == f"Your request for '{seed_reservation.tool.title}' has been approved."
    )


def test_notification_after_deny(
    client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a notification is sent to the borrower after the reservation is denied.
    """

    # seed_user2 is the borrower
    # No notifications yet
    assert len(seed_user2.notifications) == 0

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Hit deny reservation
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/deny", headers=headers
    )

    assert response.status_code == 200

    # There is deny notification
    assert (
        seed_user2.notifications[0].content
        == f"Your request for '{seed_reservation.tool.title}' was denied by the tool owner."
    )


def test_notification_after_pickup(
    db_session, client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a notification is sent to the owner after the reservation is picked up.
    """

    # seed_user is the owner
    # No notifications yet
    assert len(seed_user.notifications) == 0

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Set the reservation status to APPROVED
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # Hit pickup reservation
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/pickup", headers=headers
    )

    assert response.status_code == 200

    # There is pickup notification
    assert (
        seed_user.notifications[0].content
        == f"{seed_user2.first_name} {seed_user2.last_name} has marked '{seed_reservation.tool.title}' as picked up."
    )


def test_notification_after_return(
    db_session, client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a notification is sent to the borrower after the reservation is returned.
    """

    # seed_user2 is the borrower
    # No notifications yet
    assert len(seed_user2.notifications) == 0

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # Hit return reservation
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/return", headers=headers
    )

    assert response.status_code == 200

    # There is return notification
    assert (
        seed_user2.notifications[0].content
        == f"Return confirmed for '{seed_reservation.tool.title}'. Don't forget to leave a review."
    )


def test_notification_after_cancel(
    client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a notification is sent to the user after the reservation is cancelled.
    """

    # seed_user2 is the borrower
    # No notifications yet
    assert len(seed_user2.notifications) == 0

    # seed_user is the owner who cancelled the reservation
    headers = get_auth_headers(seed_user.id)

    # Hit cencel reservation
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/cancel", headers=headers
    )

    assert response.status_code == 200

    # There is cancel notification
    assert (
        seed_user2.notifications[0].content
        == f"The reservation for '{seed_reservation.tool.title}' was cancelled by {seed_user.first_name} {seed_user.last_name}."
    )


def test_get_only_unread_notifications(
    client,
    db_session: Session,
    seed_user,
    get_auth_headers,
):
    """
    Tests that only unread notifications are returned.
    """
    headers = get_auth_headers(seed_user.id)

    # Seed two notifications
    # 1st
    create_notification(
        db=db_session,
        recipient_id=seed_user.id,
        category=NotificationCategory.SYSTEM,
        title="Test Title",
        content="Test content",
    )
    # 2nd
    create_notification(
        db=db_session,
        recipient_id=seed_user.id,
        category=NotificationCategory.SYSTEM,
        title="Test Title 2",
        content="Test content 2",
    )
    db_session.commit()

    # Read the first notification
    for notification in seed_user.notifications:
        if notification.title == "Test Title":
            notification.is_read = True
    db_session.commit()

    # Get all notifications
    response = client.get("/api/notifications?unread_only=true", headers=headers)
    print(response.json())
    assert response.status_code == 200
    notifications = response.json()
    assert len(notifications) == 1
    assert notifications[0]["title"] == "Test Title 2"
