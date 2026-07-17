from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservation import APP_TIMEZONE
from sqlalchemy.orm import Session

# These days are used in the reservation tests
# Local time is 00:00:00 converted to UTC
today = (
    datetime.now(APP_TIMEZONE)
    .replace(hour=0, minute=0, second=0)
    .astimezone(ZoneInfo("UTC"))
)
tomorrow = today + timedelta(days=1)


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


# US 2 Scenario 1: Valid reservation request
def test_successful_reservation_request(
    client, seed_user3, seed_tool, get_auth_headers
):
    """
    Test that a user can create a reservation request.
    """
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": today.strftime("%Y-%m-%dT%H:%M:%SZ"),  # local 00:00:00 of today
        "end_date": (today + timedelta(hours=23, minutes=59, seconds=59)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 23:59:59 of today
    }

    response = client.post("/api/reservations", headers=headers, json=payload)
    assert response.status_code == 201
    assert response.json()["status"] == ReservationStatus.REQUESTED
    assert response.json()["tool_id"] == str(seed_tool.id)


#  US 2 Scenario 2: Invalid date range
def test_invalid_date_range(client, seed_user3, seed_tool, get_auth_headers):
    """
    Test that user cannot create a reservation request with invalid date range.
    """
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": tomorrow.strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 00:00:00 of tomorrow
        "end_date": (today + timedelta(hours=23, minutes=59, seconds=59)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 23:59:59 of today
    }

    response = client.post("/api/reservations", headers=headers, json=payload)
    assert response.status_code == 422
    assert (
        response.json()["detail"][0]["msg"]
        == "Value error, The reservation end date must be after the start date."
    )


# US 2 Scenario 3: Incomplete request
def test_incomplete_reservation_request(
    client, seed_user3, seed_tool, get_auth_headers
):
    """
    Test that user cannot create a reservation with incomplete request.
    """
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": today.strftime("%Y-%m-%dT%H:%M:%SZ"),  # local 00:00:00 of today
        # missing end_date
    }

    response = client.post("/api/reservations", headers=headers, json=payload)

    # Missing field
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Field required"


# US 2 Scenario 4: Reservation request overlaps an existing approved reservation
def test_overlapping_approved_reservation_request(
    db_session: Session,
    client,
    seed_user3,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that user cannot create a reservation request with overlapping approved reservation.
    """
    # Set the reservation status to approved that the reservation becomes active
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": today.strftime("%Y-%m-%dT%H:%M:%SZ"),  # local 00:00:00 of today
        "end_date": (today + timedelta(hours=23, minutes=59, seconds=59)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 23:59:59 of today
    }

    # The existing approved seed_reservation has a start_date of today 00:00:00 and the end_date of tomorrow 23:59:59
    # In the payload the reservation request has a start_date of today 00:00:00 and the end_date of today 23:59:59
    # Overlap is today date
    response = client.post("/api/reservations", headers=headers, json=payload)

    # Conflict
    assert response.status_code == 409
    assert "The tool is already reserved" in response.json()["detail"]


# US 2 Scenario 5: Reservation request overlaps an existing PICKED_UP reservation
def test_overlapping_picked_up_reservation_request(
    db_session: Session,
    client,
    seed_user3,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that user cannot create a reservation request with overlapping picked up reservation.
    """
    # Set the reservation status to picked up that the reservation becomes active
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": today.strftime("%Y-%m-%dT%H:%M:%SZ"),  # local 00:00:00 of today
        "end_date": (today + timedelta(hours=23, minutes=59, seconds=59)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 23:59:59 of today
    }

    # The existing picked up seed_reservation has a start_date of today 00:00:00 and the end_date of tomorrow 23:59:59
    # In the payload the reservation request has a start_date of today 00:00:00 and the end_date of today 23:59:59
    # Overlap is today date
    response = client.post("/api/reservations", headers=headers, json=payload)

    # Conflict
    assert response.status_code == 409
    assert "The tool is already reserved" in response.json()["detail"]


# US 2 Scenario 6: Reservation request contains past dates
def test_past_date_reservation_request(client, seed_user3, seed_tool, get_auth_headers):
    """
    Test that user cannot create a reservation request with past dates.
    """
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "tool_id": str(seed_tool.id),
        "borrower_id": str(seed_user3.id),
        "loan_duration_limit": seed_tool.loan_duration_limit,
        "start_date": (today - timedelta(days=1)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 00:00:00 of yesterday
        "end_date": (today + timedelta(hours=23, minutes=59, seconds=59)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),  # local 23:59:59 of today
    }

    response = client.post("/api/reservations", headers=headers, json=payload)
    assert response.status_code == 422
    assert (
        "Reservation dates cannot be in the past" in response.json()["detail"][0]["msg"]
    )


# US 4 Scenario 1: Tool owner approves request
def test_owner_approves_request(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner can approve a reservation request.
    """

    # seed_user is the owner of the tool
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the REQUESTED state
    assert seed_reservation.status == ReservationStatus.REQUESTED

    # Approve reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 200
    assert seed_reservation.status == ReservationStatus.APPROVED


# US 4 Scenario 2: Tool owner denyes request
def test_owner_denies_request(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner can deny a reservation request.
    """

    # seed_user is the owner of the tool
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the REQUESTED state
    assert seed_reservation.status == ReservationStatus.REQUESTED

    # Deny reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 200
    assert seed_reservation.status == ReservationStatus.DENIED


# US 4 Scenario 3: Non-owner cannot approve request
def test_not_owner_approves_request(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a not tool owner cannot approve a reservation request.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # The reservation is in the REQUESTED state
    assert seed_reservation.status == ReservationStatus.REQUESTED

    # Approve reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 403
    assert seed_reservation.status == ReservationStatus.REQUESTED


# US 4 Scenario 4: Non-owner cannot deny request
def test_not_owner_denies_request(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a not tool owner cannot deny a reservation request.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # The reservation is in the REQUESTED state
    assert seed_reservation.status == ReservationStatus.REQUESTED

    # Deny reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 403
    assert seed_reservation.status == ReservationStatus.REQUESTED


# US 4 Scenario 5: Attempt to approve a reservation that is not the status of REQUESTED
def test_approve_reservation_with_approved_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot approve an approved reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the APPROVED status
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # Approve reservation with status of APPROVED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.APPROVED


# US 4 Scenario 5: Attempt to approve a reservation that is not the status of REQUESTED
def test_approve_reservation_with_denied_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot approve a denied reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the DENIED status
    seed_reservation.status = ReservationStatus.DENIED
    db_session.commit()

    # Approve reservation with status of DENIED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.DENIED


# US 4 Scenario 5: Attempt to approve a reservation that is not the status of REQUESTED
def test_approve_reservation_with_picked_up_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot approve a picked up reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the PICKED_UP status
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # Approve reservation with status of PICKED_UP
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.PICKED_UP


# US 4 Scenario 5: Attempt to approve a reservation that is not the status of REQUESTED
def test_approve_reservation_with_returned_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot approve a returned reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the RETURNED status
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    # Approve reservation with status of RETURNED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.RETURNED


# US 4 Scenario 5: Attempt to approve a reservation that is not the status of REQUESTED
def test_approve_reservation_with_canceled_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot approve a canceled reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the CANCELED status
    seed_reservation.status = ReservationStatus.CANCELED
    db_session.commit()

    # Approve reservation with status of CANCELED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/approve", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.CANCELED


# US 4 Scenario 6: Attempt to deny a reservation that is not the status of REQUESTED
def test_deny_reservation_with_approved_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot deny an approved reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the APPROVED status
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # Deny reservation with status of APPROVED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.APPROVED


# US 4 Scenario 6: Attempt to deny a reservation that is not the status of REQUESTED
def test_deny_reservation_with_denied_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot deny a denied reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the DENIED status
    seed_reservation.status = ReservationStatus.DENIED
    db_session.commit()

    # Deny reservation with status of DENIED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.DENIED


# US 4 Scenario 6: Attempt to deny a reservation that is not the status of REQUESTED
def test_deny_reservation_with_picked_up_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot deny a picked up reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the PICKED_UP status
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # Deny reservation with status of PICKED_UP
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.PICKED_UP


# US 4 Scenario 6: Attempt to deny a reservation that is not the status of REQUESTED
def test_deny_reservation_with_returned_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot deny a returned reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the RETURNED status
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    # Deny reservation with status of RETURNED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.RETURNED


# US 4 Scenario 6: Attempt to deny a reservation that is not the status of REQUESTED
def test_deny_reservation_with_canceled_status(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot deny a canceled reservation request.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the CANCELED status
    seed_reservation.status = ReservationStatus.CANCELED
    db_session.commit()

    # Deny reservation with status of CANCELED
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/deny", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.CANCELED


# US 4 Scenario 7: Approving a reservation auto-denies overlapping requests
def test_approve_reservation_auto_denies_overlapping_requests(
    db_session: Session,
    client,
    seed_user,
    seed_user3,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """ "
    Test that approving a reservation auto-denies overlapping requests
    """
    # seed_reservation is in the REQUESTED status, starting today and ending tomorrow

    # Create one more reservation that overlaps with seed_reservation
    # Set start_date to today at 00:00:00 and end_date to tomorrow at 23:59:59
    # The reservation is in status REQUESTED
    overlapping_reservation = Reservation(
        tool_id=seed_tool.id,  # The owner is seed_user
        borrower_id=seed_user3.id,
        loan_duration_limit=seed_tool.loan_duration_limit,
        # Get current local datetime; set time to 00:00; convert to UTC
        start_date=datetime.now(APP_TIMEZONE)
        .replace(hour=0, minute=0, second=0)
        .astimezone(ZoneInfo("UTC")),
        # Get current local datetime; set time to 23:59; convert to UTC + 1 day
        end_date=datetime.now(APP_TIMEZONE)
        .replace(hour=23, minute=59, second=59)
        .astimezone(ZoneInfo("UTC"))
        + timedelta(days=1),
    )
    db_session.add(overlapping_reservation)
    db_session.commit()

    # Login as the owner
    headers = get_auth_headers(seed_user.id)

    # The overlapping_reservation is in the REQUESTED status
    assert overlapping_reservation.status == ReservationStatus.REQUESTED

    # The seed_reservation is in the REQUESTED status
    assert seed_reservation.status == ReservationStatus.REQUESTED

    # Approve the seed_reservation
    client.post(f"/api/reservations/{seed_reservation.id}/approve", headers=headers)

    db_session.refresh(overlapping_reservation)
    db_session.refresh(seed_reservation)
    # The seed_reservation is in the APPROVED status
    assert seed_reservation.status == ReservationStatus.APPROVED

    # The overlapping_reservation is in the DENIED status
    assert overlapping_reservation.status == ReservationStatus.DENIED


# US 7 Scenario 1: Valid Pickup
def test_borrower_picks_up_reservation(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower can pick up a reservation.
    """

    # Set the reservation status to APPROVED
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # seed_user2 is the borrower of the tool
    headers = get_auth_headers(seed_user2.id)

    # Pick up reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/pickup", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 200
    assert seed_reservation.status == ReservationStatus.PICKED_UP


# US 7 Scenario 2: Non-borrower cannot mark a reservation as picked up
def test_not_borrower_picks_up_reservation(
    db_session: Session,
    client,
    seed_user3,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that not borrower cannot pick up a reservation.
    """

    # Set the reservation status to APPROVED
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # seed_user3 is not the borrower
    headers = get_auth_headers(seed_user3.id)

    # Pick up reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/pickup", headers=headers
    )

    db_session.refresh(seed_reservation)
    # Forbidden
    assert response.status_code == 403
    assert seed_reservation.status == ReservationStatus.APPROVED


# US 7 Scenario 3: Cannot pick up an unapproved reservation
def test_borrower_picks_up_unapproved_reservation(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower cannot pick up a unapproved reservation.
    """

    assert seed_reservation.status == ReservationStatus.REQUESTED

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Pick up reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/pickup", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.REQUESTED


# US 7 Scenario 4: Reservation already picked up
def test_borrower_picks_up_already_picked_up_reservation(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower cannot pick up already picked up reservation.
    """

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Pick up reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/pickup", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.PICKED_UP


# US 7 Scenario 5: Pickup attempt outside reservation date range
def test_borrower_picks_up_outside_reservation_date_range(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower cannot pick up a reservation outside of the approved date range.
    """

    # Set the reservation status to APPROVED
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # The seed_reservation start date is today 00:00:00, end date is tomorrow 23:59:59
    # Set the reservation start date to tomorrow 00:00:00
    seed_reservation.start_date = seed_reservation.start_date + timedelta(days=1)
    # Keep the reservation end date to tomorrow 23:59:59
    db_session.commit()

    # Pick up reservation
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/pickup", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 400
    assert seed_reservation.status == ReservationStatus.APPROVED


# US 5 Scenario 1: Valid return confirmation
def test_owner_confirms_return(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that an owner can confirm a return.
    """

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Confirm return
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/return", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 200
    assert seed_reservation.status == ReservationStatus.RETURNED


# US 5 Scenario 2: Non-owner cannot confirm a return
def test_not_owner_confirms_return(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a non-owner cannot confirm a return.
    """

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # seed_user2 is not the owner
    headers = get_auth_headers(seed_user2.id)

    # Confirm return
    response = client.post(
        f"/api/reservations/{seed_reservation.id}/return", headers=headers
    )

    db_session.refresh(seed_reservation)
    assert response.status_code == 403
    assert seed_reservation.status == ReservationStatus.PICKED_UP


# US 5 Scenario 3: Cannot confirm return unless the status is PICKED_UP
def test_owner_confirms_return_not_picked_up_reservation(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that an owner cannot confirm a return unless the status is PICKED_UP.
    """

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # List of reservation statuses that are not PICKED_UP
    not_allowed_reservation_statuses = [
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
        ReservationStatus.RETURNED,
        ReservationStatus.DENIED,
        ReservationStatus.CANCELED,
    ]

    for status in not_allowed_reservation_statuses:
        # Set the reservation status
        seed_reservation.status = status
        db_session.commit()

        # Confirm return
        response = client.post(
            f"/api/reservations/{seed_reservation.id}/return", headers=headers
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 400
        assert seed_reservation.status == status


# US 3 Scenario 1: Valid tool cancellation
def test_owner_cancels_reservation(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner can cancel a reservation when the status is in the REQUESTED or APPROVED.
    """

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # The reservation is in the REQUESTED or APPROVED status
    allowed_reservation_statuses = [
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
    ]

    for status in allowed_reservation_statuses:
        # Set the reservation status
        seed_reservation.status = status
        db_session.commit()

        # Cancel reservation
        response = client.post(
            f"/api/reservations/{seed_reservation.id}/cancel", headers=headers
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 200
        assert seed_reservation.status == ReservationStatus.CANCELED


# US 3 Scenario 2: Cancellation not allowed after pickup;
# US 3 Scenario 3: Cancellation not allowed for completed reservation;
# US 3 Scenario 4: Cancellation not allowed for already cancelled reservation
# Cancellation not allowed for declined reservation
def test_owner_cancels_reservation_after_pickup(
    db_session: Session,
    client,
    seed_user,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool owner cannot cancel a reservation after the tool has been picked up, denied, returned, or canceled.
    """

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Set the reservation status to PICKED_UP, DENIED, RETURNED, or CANCELED
    not_allowed_reservation_statuses = [
        ReservationStatus.RETURNED,
        ReservationStatus.DENIED,
        ReservationStatus.CANCELED,
        ReservationStatus.PICKED_UP,
    ]

    for status in not_allowed_reservation_statuses:
        seed_reservation.status = status
        db_session.commit()

        # Cancel reservation
        response = client.post(
            f"/api/reservations/{seed_reservation.id}/cancel", headers=headers
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 400
        assert seed_reservation.status == status


# US 3 Scenario 5: Valid tool cancellation
def test_borrower_cancels_reservation(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower can cancel a reservation when the status is in the REQUESTED or APPROVED.
    """

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # The reservation is in the REQUESTED or APPROVED status
    allowed_reservation_statuses = [
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
    ]

    for status in allowed_reservation_statuses:
        # Set the reservation status
        seed_reservation.status = status
        db_session.commit()

        # Cancel reservation
        response = client.post(
            f"/api/reservations/{seed_reservation.id}/cancel", headers=headers
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 200
        assert seed_reservation.status == ReservationStatus.CANCELED


# US 3 Scenario 6: Cancellation not allowed after pickup
# US 3 Scenario 7: Cancellation not allowed for completed reservation
# US 3 Scenario 8:  Cancellation not allowed for already cancelled reservation
# Cancellation not allowed for declined reservation
def test_borrower_cancels_reservation_after_pickup(
    db_session: Session,
    client,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a borrower cannot cancel a reservation after the tool has been picked up, denied, returned, or canceled.
    """

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Set the reservation status to PICKED_UP, DENIED, RETURNED, or CANCELED
    not_allowed_reservation_statuses = [
        ReservationStatus.RETURNED,
        ReservationStatus.DENIED,
        ReservationStatus.CANCELED,
        ReservationStatus.PICKED_UP,
    ]

    for status in not_allowed_reservation_statuses:
        seed_reservation.status = status
        db_session.commit()

        # Cancel reservation
        response = client.post(
            f"/api/reservations/{seed_reservation.id}/cancel", headers=headers
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 400
        assert seed_reservation.status == status
