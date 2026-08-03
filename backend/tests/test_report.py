from app.models.report import ReportCategory, ReportStatus, ReportTargetType
from app.models.user import UserStatus
from sqlalchemy.orm import Session


# US 14 Scenario 6: Successful Issue Reported
def test_create_reservation_report(
    client,
    seed_tool,
    seed_user,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a reservation report can be created
    """
    headers = get_auth_headers(seed_user.id)

    # User fill out report form
    payload = {
        "category": ReportCategory.TOOL_DAMAGED.value,
        "description": "My tool is broken",
        # Target should be passed by frontend automatically, not by the user
        # Since the user is submitting the report from the reservation page
        "target_id": str(seed_reservation.id),
        "target_type": ReportTargetType.RESERVATION.value,
    }

    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    assert response.status_code == 201

    report = response.json()

    assert report["category"] == ReportCategory.TOOL_DAMAGED.value
    assert report["description"] == "My tool is broken"
    assert report["target_id"] == str(seed_reservation.id)
    assert report["target_type"] == ReportTargetType.RESERVATION.value
    assert report["status"] == ReportStatus.ACTIVE.value


# US 14 Scenario 6: Successful Issue Reported
def test_create_tool_report(
    client,
    seed_tool,
    seed_user,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a tool report can be created
    """
    headers = get_auth_headers(seed_user.id)

    # User fill out report form
    payload = {
        "category": ReportCategory.OTHER.value,
        "description": "It is inappropriate language used in the description",
        "target_id": str(seed_tool.id),
        "target_type": ReportTargetType.TOOL.value,
    }

    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    assert response.status_code == 201


# US 14 Scenario 6: Successful Issue Reported
def test_create_user_report(
    client,
    seed_user,
    seed_user2,
    get_auth_headers,
):
    """
    Test that a user report can be created
    """
    headers = get_auth_headers(seed_user.id)

    # User fill out report form
    payload = {
        "category": ReportCategory.INAPPROPRIATE_BEHAVIOR.value,
        "description": "I was harassed by this user",
        "target_id": str(seed_user2.id),
        "target_type": ReportTargetType.USER.value,
    }

    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    assert response.status_code == 201


# US 14 Scenario 1: User not logged in
def test_create_report_not_logged_in(client, seed_reservation):
    """
    Test that a report cannot be created when the user is not logged in
    """
    # No headers

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": str(seed_reservation.id),
        "target_type": ReportTargetType.RESERVATION.value,
    }
    # Hit create report
    response = client.post("/api/reports", json=payload)

    # Authorization error
    assert response.status_code == 401


# US 14 Scenario 2: Inactive User Account
def test_create_report_inactive_user(
    client, db_session: Session, seed_user, seed_reservation, get_auth_headers
):
    """
    Test that a report cannot be created when the user has an inactive account
    """
    headers = get_auth_headers(seed_user.id)

    # Suspend the user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": str(seed_reservation.id),
        "target_type": ReportTargetType.RESERVATION.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Forbidden
    assert response.status_code == 403


# US 14 Scenario 3: Reservation, tool, or user does not exist
def create_report_reservation_not_exist(client, seed_user, get_auth_headers):
    """
    Test that a report cannot be created when the reservation does not exist
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": "e0000000-0000-0000-0000-000000000999",
        "target_type": ReportTargetType.RESERVATION.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Not found
    assert response.status_code == 404


# US 14 Scenario 3: Reservation, tool, or user does not exist
def create_report_tool_not_exist(client, seed_user, get_auth_headers):
    """
    Test that a report cannot be created when the tool does not exist
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": "e0000000-0000-0000-0000-000000000999",
        "target_type": ReportTargetType.TOOL.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Not found
    assert response.status_code == 404


# US 14 Scenario 3: Reservation, tool, or user does not exist
def test_create_report_user_not_exist(client, seed_user, get_auth_headers):
    """
    Test that a report cannot be created when the user does not exist
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": "e0000000-0000-0000-0000-000000000999",
        "target_type": ReportTargetType.USER.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Not found
    assert response.status_code == 404


# US 14 Scenario 4: User is not the borrower or tool owner in the specified reservation
def test_create_report_not_borrower_or_tool_owner(
    client,
    seed_user3,
    seed_reservation,
    get_auth_headers,
):
    """
    Test that a report cannot be created when the user is not the borrower or tool owner
    """
    # seed_user3 is not the borrower or tool owner
    headers = get_auth_headers(seed_user3.id)

    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "The tool was returned on 10 days later than the due date",
        "target_id": str(seed_reservation.id),
        "target_type": ReportTargetType.RESERVATION.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Forbidden
    assert response.status_code == 403


# US 14 Scenario 5: Invalid Report Information
def test_report_invalid_information(
    client, seed_user, seed_reservation, get_auth_headers
):
    """
    Test that a report cannot be created when the report information is invalid
    """
    headers = get_auth_headers(seed_user.id)

    # User fill out report form
    # Description is empty
    payload = {
        "category": ReportCategory.LATE_RETURN.value,
        "description": "",
        "target_id": str(seed_reservation.id),
        "target_type": ReportTargetType.RESERVATION.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Pydantic error
    assert response.status_code == 422


def test_report_themself(client, seed_user, get_auth_headers):
    """
    Tests that a user cannot report themself
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "category": ReportCategory.INAPPROPRIATE_BEHAVIOR.value,
        "description": "This user is harassing me",
        "target_id": str(seed_user.id),
        "target_type": ReportTargetType.USER.value,
    }
    # Hit create report
    response = client.post("/api/reports", headers=headers, json=payload)

    # Bad request
    assert response.status_code == 400


def test_access_target_types(client, seed_user, get_auth_headers):
    """
    Tests that a user can access target types
    """
    headers = get_auth_headers(seed_user.id)

    # Hit get target types
    response = client.get("/api/reports/target-types", headers=headers)

    # Success
    assert response.status_code == 200


def test_access_report_categories(client, seed_user, get_auth_headers):
    """
    Tests that a user can access report categories
    """
    headers = get_auth_headers(seed_user.id)

    # Hit get report categories
    response = client.get("/api/reports/categories", headers=headers)

    # Success
    assert response.status_code == 200
