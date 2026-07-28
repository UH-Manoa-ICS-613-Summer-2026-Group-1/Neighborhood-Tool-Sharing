from datetime import datetime, timedelta, timezone

from app.models.reservation import ReservationStatus
from app.models.user import UserStatus
from sqlalchemy.orm import Session


# US 8 Scenario 1: Send a message successfully
def test_owner_sends_message_successfully(
    client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the owner can send a message successfully
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    message = response.json()
    assert message["content"] == "This is a test message"
    assert message["sender_id"] == str(seed_user.id)


# US 8 Scenario 1: Send a message successfully
def test_borrower_sends_message_successfully(
    client, seed_reservation, seed_user2, get_auth_headers
):
    """
    Test that the borrower can send a message successfully
    """
    headers = get_auth_headers(seed_user2.id)

    payload = {
        "content": "This is a test message",
    }

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201
    message = response.json()
    assert message["content"] == "This is a test message"
    assert message["sender_id"] == str(seed_user2.id)


# US 8 Scenario 2: View reservation messages
def test_owner_view_messages(
    client, seed_reservation, seed_user, get_auth_headers, seed_message
):
    """
    Test that the owner can view messages successfully.
    The message is from the owner. Message.content is "This is a test message".

    """
    headers = get_auth_headers(seed_user.id)

    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}/messages", headers=headers
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 1

    assert messages[0]["content"] == "This is a test message"
    assert messages[0]["sender_id"] == str(seed_user.id)
    # The message remains unread. It is the owner who sent the message
    assert messages[0]["is_read"] is False


# US 8 Scenario 2: View reservation messages
def test_borrower_view_messages(
    client, seed_reservation, seed_user, seed_user2, get_auth_headers, seed_message
):
    """
    Test that the borrower can view messages successfully.
    The message is from the owner. Message.content is "This is a test message".
    """
    headers = get_auth_headers(seed_user2.id)

    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}/messages", headers=headers
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 1

    assert messages[0]["content"] == "This is a test message"
    assert messages[0]["sender_id"] == str(seed_user.id)
    # The message becomes read
    assert messages[0]["is_read"] is True


# US 8 Scenario 3: Attempt to send an empty message
def test_send_empty_message(client, seed_reservation, seed_user, get_auth_headers):
    """
    Test that the owner cannot send an empty message.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "    ",
    }

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    # Pydantic validation error
    assert response.status_code == 422
    assert (
        response.json()["detail"][0]["msg"] == "String should have at least 1 character"
    )


# US 8 Scenario 4: Unauthorized user cannot send messages
def test_unauthorized_user_cannot_send_message(
    client, seed_reservation, seed_user3, get_auth_headers
):
    """
    Test that the unauthorized user cannot send a message.
    seed_user3 is not associated with the reservation
    """
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "content": "This is a test message",
    }

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    # Forbidden
    assert response.status_code == 403


# US 8 Scenario 5: Suspended user cannot send messages
def test_suspended_user_cannot_send_message(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the suspended user cannot send a message.
    seed_user is associated with the reservation but becomes suspended
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Simulate an admin suspending the user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    # Forbidden
    assert response.status_code == 403


# US 8 Scenario 6: Logged out user cannot send messages
def test_logged_out_user_cannot_send_message(client, seed_reservation):
    """
    Test that the logged out user cannot send a message.
    """
    payload = {
        "content": "This is a test message",
    }

    # No headers
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        json=payload,
    )
    # Authorization error
    assert response.status_code == 401


# US 8 Scenario 7: Unauthorized user cannot view messages
def test_unauthorized_user_cannot_view_messages(
    client, seed_reservation, seed_user3, get_auth_headers
):
    """
    Test that the unauthorized user cannot view messages.
    seed_user3 is not associated with the reservation
    """
    headers = get_auth_headers(seed_user3.id)

    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
    )
    # Forbidden
    assert response.status_code == 403


# US 8 Scenario 8: Suspended user cannot view messages
def test_suspended_user_cannot_view_messages(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the suspended user cannot view messages.
    seed_user is associated with the reservation but becomes suspended
    """
    headers = get_auth_headers(seed_user.id)

    # Simulate an admin suspending the user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
    )
    # Forbidden
    assert response.status_code == 403


# US 8 Scenario 9: Logged out user cannot view messages
def test_logged_out_user_cannot_view_messages(client, seed_reservation):
    """
    Test that the logged out user cannot view messages.
    """
    # No headers
    response = client.get(f"/api/reservations/{str(seed_reservation.id)}/messages")

    # Authorization error
    assert response.status_code == 401


def test_user_cannot_send_message_to_non_existent_reservation(
    client, seed_user, get_auth_headers
):
    """
    Test that the user cannot send a message to a non-existent reservation
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Post a message to a non-existent reservation
    not_existing_reservation_uuid = "e0000000-0000-0000-0000-000000000999"
    response = client.post(
        f"/api/reservations/{not_existing_reservation_uuid}/messages",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Reservation not found."


def test_user_cannot_message_to_denied_reservation(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the user cannot send a message to a denied reservation.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Simulate a denied reservation
    seed_reservation.status = ReservationStatus.DENIED
    db_session.commit()

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 400


def test_user_cannot_message_to_cancelled_reservation(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the user cannot send a message to a cancelled reservation.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Simulate a cancelled reservation
    seed_reservation.status = ReservationStatus.CANCELED
    db_session.commit()

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 400


def test_user_cannot_message_to_returned_reservation_after_24_hours(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the user cannot send a message to a returned reservation after 24 hours.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Simulate a returned reservation
    seed_reservation.status = ReservationStatus.RETURNED
    # End date is 24 hours ago
    seed_reservation.end_date = (
        (datetime.now(timezone.utc) - timedelta(hours=24, seconds=1)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
    )
    db_session.commit()

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    print(seed_reservation.end_date)
    assert response.status_code == 400


def test_user_can_message_to_returned_reservation_within_24_hours(
    db_session: Session, client, seed_reservation, seed_user, get_auth_headers
):
    """
    Test that the user can send a message to a returned reservation within 24 hours.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "content": "This is a test message",
    }

    # Simulate a returned reservation
    seed_reservation.status = ReservationStatus.RETURNED
    # End date is 23 hours ago
    seed_reservation.end_date = (
        (datetime.now(timezone.utc) - timedelta(hours=23)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
    )
    db_session.commit()

    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/messages",
        headers=headers,
        json=payload,
    )
    print(seed_reservation.end_date)
    assert response.status_code == 201
    message = response.json()
    assert message["content"] == "This is a test message"


def test_view_message_not_existing_reservaiton(client, seed_user, get_auth_headers):
    """
    Test that the user cannot view messages for a non-existent reservation.
    """
    headers = get_auth_headers(seed_user.id)

    # Post a message to a non-existent reservation
    not_existing_reservation_uuid = "e0000000-0000-0000-0000-000000000999"
    response = client.get(
        f"/api/reservations/{not_existing_reservation_uuid}/messages",
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Reservation not found."
