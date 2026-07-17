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
