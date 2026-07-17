from app.models.reservation import ReservationStatus
from app.models.tool import ToolStatus
from app.models.user import UserStatus
from app.schemas.reservation import APP_TIMEZONE
from app.utils.storage import DUMMY_IMAGE_URL
from sqlalchemy.orm import Session


# US 27 Scenario 3: Prevent conflicting request
def test_reject_conflicting_reservation(
    db_session, client, seed_user3, seed_reservation, get_auth_headers
):
    """
    Tests that user cannot create a new resevtaion on confilt time period.
    """
    headers = get_auth_headers(seed_user3.id)

    # Set the reservation status to approved that the reservation becomes active
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # The reservation is approved for today and tomorrow.
    # Hit reservation create endpoint with same data: start today, end tomorrow, same tool
    payload = {
        "tool_id": str(seed_reservation.tool_id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_reservation.loan_duration_limit,
        "start_date": seed_reservation.start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end_date": seed_reservation.end_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    print(payload)
    response = client.post("/api/reservations", headers=headers, json=payload)

    # Conflict
    assert response.status_code == 409
    assert "The tool is already reserved" in response.json()["detail"]


# US 9 Owner can view their reservations
def test_owner_successful_view_tool_reservations(
    client, seed_user, seed_reservation, get_auth_headers
):
    """
    Test that an owner can view their reservations.
    """
    # seed_user is the owner
    # seed_user2 is the borrower

    headers = get_auth_headers(seed_user.id)

    # Hit show all reservations
    response = client.get("/api/reservations", headers=headers)
    assert response.status_code == 200

    reservations = response.json()

    reservation_exists = False
    for reservation in reservations:
        if reservation["tool_id"] == str(seed_reservation.tool_id):
            reservation_exists = True
            break
    assert reservation_exists

    # Hit detailed view of the reservation
    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["tool_id"] == str(seed_reservation.tool_id)


# US 10 Borrower can view their reservations
def test_borrower_successful_view_tool_reservations(
    client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Test that a borrower can view their reservations.
    """
    # seed_user is the owner
    # seed_user2 is the borrower

    headers = get_auth_headers(seed_user2.id)

    # Hit show all reservations
    response = client.get("/api/reservations", headers=headers)
    assert response.status_code == 200

    reservations = response.json()

    reservation_exists = False
    for reservation in reservations:
        if reservation["tool_id"] == str(seed_reservation.tool_id):
            reservation_exists = True
            break
    assert reservation_exists

    # Hit detailed view of the reservation
    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["tool_id"] == str(seed_reservation.tool_id)


# US 9; US 10 Users cannot view another user's reservations
def test_other_user_unsuccessful_view_tool_reservations(
    client, seed_user3, seed_reservation, get_auth_headers
):
    """
    Test that a borrower can view their reservations.
    """
    # seed_user is the owner
    # seed_user2 is the borrower
    # seed_user3 is not related to the reservation (seed_reservation)

    headers = get_auth_headers(seed_user3.id)

    # Hit show all reservations
    response = client.get("/api/reservations", headers=headers)

    # User stiil can view their reservations
    assert response.status_code == 200

    reservations = response.json()

    reservation_exists = False
    for reservation in reservations:
        if reservation["tool_id"] == str(seed_reservation.tool_id):
            reservation_exists = True
            break

    # Do not find the reservation
    assert not reservation_exists

    # Hit detailed view of the reservation
    response = client.get(
        f"/api/reservations/{str(seed_reservation.id)}", headers=headers
    )

    # Forbidden
    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "You do not have administrative permission to view this reservation."
    )
