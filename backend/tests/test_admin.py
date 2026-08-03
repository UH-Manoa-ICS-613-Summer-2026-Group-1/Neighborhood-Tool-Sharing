from app.models.invitation import InvitationStatus
from app.models.report import Report, ReportCategory, ReportStatus, ReportTargetType
from app.models.reservation import ReservationStatus
from app.models.tool import ToolStatus
from app.models.user import UserStatus
from sqlalchemy.orm import Session


# US 13 Scenario 1: User not logged in
def test_suspend_user_not_logged_in(client, seed_user):
    """
    Tests that an admin who is not logged in cannot suspend another user's account.
    """
    # Admin is not logged in

    # Hit suspend a user
    response = client.post(f"/api/admin/users/{str(seed_user.id)}/suspend")

    # Unauthorized
    assert response.status_code == 401

    assert seed_user.status.code == "ACTIVE"


# US 13 Scenario 2: Inactive User Account
#         Given the user does not have an active account
#         When the user attempts to deactivate a user account
#         Then the system rejects the action
#         And an error message is displayed
def test_suspend_user_not_active_account(
    client, seed_user, db_session: Session, seed_admin, get_auth_headers
):
    """
    Tests that an admin with an inactive account cannot suspend another user's account.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Deactivate the admin user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_admin.status = suspended_status
    db_session.commit()

    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # Forbidden
    assert response.status_code == 403

    assert seed_user.status.code == "ACTIVE"


# US 13 Scenario 3: Insufficient Privileges
def test_suspend_user_insufficient_privileges(
    client, seed_user, seed_user2, get_auth_headers
):
    """
    Tests that a user with insufficient privileges cannot suspend another user's account.
    """
    # Usual user login
    headers = get_auth_headers(seed_user2.id)

    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # Forbidden
    assert response.status_code == 403

    assert seed_user.status.code == "ACTIVE"


# US 13 Scenario 4: User Already Deactivated
def test_suspend_user_already_suspended(
    client, seed_user, db_session: Session, seed_admin, get_auth_headers
):
    """
    Tests that an admin cannot suspend an already suspended user's account.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # Bad Request
    assert response.status_code == 400

    assert seed_user.status is not None

    # User is still suspended
    assert seed_user.status.code == "SUSPENDED"


# US 13 Scenario 5: User Does Not Exist
def test_suspend_user_does_not_exist(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot suspend a user that does not exist in the system.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Not exisisting user
    not_existing_user_uuid = "00000000-0000-0000-0000-000000009999"
    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(not_existing_user_uuid)}/suspend", headers=headers
    )

    # Not Found
    assert response.status_code == 404


# US 13 Scenario 6: Successful User Deactivation
def test_suspend_user_success(client, seed_user, seed_admin, get_auth_headers):
    """
    Tests that an admin can successfully suspend another user's account.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # Success
    assert response.status_code == 200

    assert seed_user.status.code == "SUSPENDED"


def test_admin_cannot_suspend_themself(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot suspend themselves.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit suspend a user
    response = client.post(
        f"/api/admin/users/{str(seed_admin.id)}/suspend", headers=headers
    )

    # Bad Request
    assert response.status_code == 400

    assert seed_admin.status.code == "ACTIVE"


def test_autocancel_after_suspention(
    client,
    seed_user,
    seed_admin,
    get_auth_headers,
    seed_reservation,
    seed_user2,
):
    """ "
    Tests that after user suspention, a related to suspended user reservation is autocancelled.
    And corresponding notification is sent.
    seed_user is the owner.
    seed_user2 is the borrower.
    seed_reservation is the REQUESTED status.
    Borrower should get a notification that the reservation has been cancelled.
    """
    headers = get_auth_headers(seed_admin.id)

    # Suspend the user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # User is suspended
    assert response.status_code == 200

    # The reservation is in the CANCELED status
    assert seed_reservation.status == ReservationStatus.CANCELED

    # There is cancel notification for seed_user2
    assert (
        seed_user2.notifications[0].content
        == f"Your reservation for '{seed_reservation.tool.title}' was cancelled because the tool owner's account was suspended."
    )


def test_notification_for_reservation_after_suspention(
    client,
    seed_user,
    db_session: Session,
    seed_admin,
    get_auth_headers,
    seed_reservation,
    seed_user2,
):
    """ "
    Tests that after user suspention, a related to suspended user PICKED_UP reservation is not cancelled.
    But corresponding notification is sent.
    seed_user is the owner.
    seed_user2 is the borrower.
    seed_reservation is the PICKED_UP reservation.
    Borrower should get a notification that the owner been suspended.
    """
    headers = get_auth_headers(seed_admin.id)

    # PICKED_UP reservation
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # Suspend the user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/suspend", headers=headers
    )

    # User is suspended
    assert response.status_code == 200

    # The reservation is still in the PICKED_UP status
    assert seed_reservation.status == ReservationStatus.PICKED_UP

    # There is notification for seed_user2
    assert (
        seed_user2.notifications[0].content
        == f"The owner of '{seed_reservation.tool.title}' has been suspended. Please return the tool as agreed upon completion."
    )

    # There is notification for seed_user
    assert (
        seed_user.notifications[0].content
        == "Your account has been suspended. Please contact support."
    )


def test_reactivate_user_success(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin can successfully reactivate user's account.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the user
    suspended_status = db_session.query(UserStatus).filter_by(code="SUSPENDED").first()
    seed_user.status = suspended_status
    db_session.commit()

    assert seed_user.status is not None
    assert seed_user.status.code == "SUSPENDED"

    # Hit reactivate a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/activate", headers=headers
    )

    # Success
    assert response.status_code == 200

    assert seed_user.status.code == "ACTIVE"


def test_reactivate_not_existing_user(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot reactivate a user that does not exist in the system.
    """
    headers = get_auth_headers(seed_admin.id)

    # Not existing user uuid
    not_existing_user_uuid = "00000000-0000-0000-0000-000000009999"

    # Hit reactivate a user
    response = client.post(
        f"/api/admin/users/{str(not_existing_user_uuid)}/activate", headers=headers
    )

    # Not Found
    assert response.status_code == 404


def test_admin_active_themself(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot reactivate themselves.
    """
    headers = get_auth_headers(seed_admin.id)

    # Hit reactivate a user
    response = client.post(
        f"/api/admin/users/{str(seed_admin.id)}/activate", headers=headers
    )

    # Bad Request
    assert response.status_code == 400


def test_reactivate_active_user(client, seed_user, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot reactivate an active user.
    """
    headers = get_auth_headers(seed_admin.id)

    # Hit reactivate a user
    response = client.post(
        f"/api/admin/users/{str(seed_user.id)}/activate", headers=headers
    )

    # Bad Request
    assert response.status_code == 400


# US 15 Scenario 1: User not logged in
def test_suspend_tool_not_logged_in(client, seed_user, seed_tool):
    """
    Tests that an admin who is not logged in cannot suspend tool listing.
    """
    # No headers
    response = client.post(f"/api/admin/tools/{str(seed_tool.id)}/suspend")

    # Authorization error
    assert response.status_code == 401

    assert seed_tool.status == ToolStatus.AVAILABLE


# US 15 Scenario 2: Inactive User Account
def test_suspend_tool_inactive_account(
    client, db_session: Session, seed_admin, seed_user, seed_tool, get_auth_headers
):
    """
    Tests that an admin with an inactive account cannot suspend tool listing.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Deactivate the admin user
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_admin.status = suspended_status
    db_session.commit()

    # Hit suspend tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Forbidden
    assert response.status_code == 403

    assert seed_tool.status == ToolStatus.AVAILABLE


# US 15 Scenario 3: Insufficient Privileges
def test_suspend_tool_insufficient_privileges(
    client, seed_user, seed_tool, get_auth_headers
):
    """
    Tests that an admin with insufficient privileges cannot suspend tool listing.
    """
    # Admin login
    headers = get_auth_headers(seed_user.id)

    # Hit suspend tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Forbidden
    assert response.status_code == 403

    assert seed_tool.status == ToolStatus.AVAILABLE


# US 15 Scenario 4: Tool Listing does not exist
def test_suspend_tool_not_exist(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot suspend a tool listing that does not exist in the system.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Not existing tool uuid
    not_existing_tool_uuid = "00000000-0000-0000-0000-000000009999"

    # Hit suspend tool
    response = client.post(
        f"/api/admin/tools/{str(not_existing_tool_uuid)}/suspend", headers=headers
    )

    # Not Found
    assert response.status_code == 404


# US 15 Scenario 5: Tool Listing already suspended
def test_suspend_tool_already_suspended(
    client, db_session: Session, seed_admin, seed_tool, get_auth_headers
):
    """
    Tests that an admin cannot suspend a tool listing that is already suspended.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the tool
    seed_tool.status = ToolStatus.SUSPENDED
    db_session.commit()

    # Hit suspend tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Bad Request
    assert response.status_code == 400


# US 15 Scenario 6: Successfully suspend listing
def test_suspend_tool_success(client, seed_admin, seed_tool, get_auth_headers):
    """
    Tests that an admin can successfully suspend a tool listing.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    assert seed_tool.status == ToolStatus.AVAILABLE

    # Hit suspend tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Success
    assert response.status_code == 200
    assert seed_tool.status == ToolStatus.SUSPENDED


def test_autocancel_reservation_after_tool_suspention(
    client,
    db_session: Session,
    seed_admin,
    seed_user,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Tests that after suspending a tool, reservations related to the tool are automatically cancelled.
    And corresponding notification is sent.
    seed_user is the owner.
    seed_usr2 is the borrower.
    seed_reservation is the REQUESTED status.
    """

    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Tool is suspended
    assert response.status_code == 200

    # The reservation is in the CANCELED status
    assert seed_reservation.status == ReservationStatus.CANCELED

    # There is cancel notification
    assert (
        seed_user2.notifications[0].content
        == f"Your reservation for '{seed_tool.title}' was cancelled because the listing was suspended by an administrator."
    )


def test_notification_after_tool_suspention(
    client,
    db_session: Session,
    seed_admin,
    seed_user,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Tests that after suspending a tool, PICKED_UP reservations related to the tool are not cancelled.
    And corresponding notification is sent.
    seed_user is the owner.
    seed_usr2 is the borrower.
    seed_reservation is the PICKED_UP status.
    """

    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Set the reservation status to PICKED_UP
    seed_reservation.status = ReservationStatus.PICKED_UP
    db_session.commit()

    # Suspend the tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/suspend", headers=headers
    )

    # Tool is suspended
    assert response.status_code == 200

    # The reservation is in the PICKED_UP status
    assert seed_reservation.status == ReservationStatus.PICKED_UP

    # There is notification for seed_user2
    assert (
        seed_user2.notifications[0].content
        == f"The tool '{seed_tool.title}' was suspended by an administrator. Please return the tool as agreed upon completion."
    )

    # There is notification for seed_user
    assert (
        seed_user.notifications[0].content
        == f"Your tool '{seed_tool.title}' has been suspended."
    )


def test_reactivate_tool_success(
    client, db_session: Session, seed_admin, seed_tool, get_auth_headers
):
    """
    Tests that an admin can successfully reactivate a tool listing.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the tool
    seed_tool.status = ToolStatus.SUSPENDED
    db_session.commit()

    assert seed_tool.status == ToolStatus.SUSPENDED

    # Hit reactivate tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/activate", headers=headers
    )

    # Success
    assert response.status_code == 200
    # After reactivation the tool becomes HIDDEN
    assert seed_tool.status == ToolStatus.HIDDEN


def test_reactivate_not_existing_tool(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot reactivate a tool listing that does not exist.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Not existing tool uuid
    not_existing_tool_uuid = "00000000-0000-0000-0000-000000009999"

    # Hit reactivate tool
    response = client.post(
        f"/api/admin/tools/{str(not_existing_tool_uuid)}/activate", headers=headers
    )

    # Not Found
    assert response.status_code == 404


def test_reactivate_tool_suspended_user(
    client,
    db_session: Session,
    seed_admin,
    seed_user,
    seed_user2,
    seed_tool,
    seed_reservation,
    get_auth_headers,
):
    """
    Tests that an admin cannot reactivate a tool listing if the owner is suspended.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Suspend the user (owner)
    suspended_status = db_session.query(UserStatus).filter_by(code="SUSPENDED").first()
    seed_user.status = suspended_status

    # Suspend the tool
    seed_tool.status = ToolStatus.SUSPENDED
    db_session.commit()

    # Hit reactivate tool
    response = client.post(
        f"/api/admin/tools/{str(seed_tool.id)}/activate", headers=headers
    )

    # Bad Request
    assert response.status_code == 400


# US 16 Scenario 4: Successful Reports
def test_admin_view_statistic_overvew(
    client, seed_admin, get_auth_headers, seed_reservation
):
    """
    Tests that an admin can view statistic overview.
    There is one tool and one reservation.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit statistic overview
    response = client.get("/api/admin/statistics/overview", headers=headers)

    # Success
    assert response.status_code == 200
    stats = response.json()

    # seed_admin and seed_user (owner) and seed_user2 (borrower)
    assert stats["total_users"] == 3
    # seed_tool
    assert stats["total_tools"] == 1
    # seed_reservation
    assert stats["total_reservations"] == 1


# US 16 Scenario 4: Successful Reports
def test_admin_view_timeseries_statistics(
    client, seed_admin, get_auth_headers, seed_reservation
):
    """
    Tests that an admin can view timeseries statistic.
    Timeframe is 7 days.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit time series statistic, timeframe is 7 days
    response = client.get(
        "/api/admin/statistics/timeseries?timeframe=7", headers=headers
    )

    # Success
    assert response.status_code == 200
    stats = response.json()

    # All 3 users accounts were created in the last 7 days
    assert stats["timeframe_new_users"] == 3


# US 16 Scenario 1: User not logged in
def test_admin_view_timeseries_statistics_not_logged_in(client):
    """
    Tests that an admin cannot view timeseries statistic if not logged in.
    """

    # Hit time series statistic, timeframe is 7 days
    response = client.get("/api/admin/statistics/timeseries?timeframe=7")

    # Unauthorized
    assert response.status_code == 401


# US 16 Scenario 2: Inactive User Account
def test_admin_view_timeseries_statistics_inactive_user(
    client, db_session: Session, seed_admin, get_auth_headers
):
    """
    Tests that an admin cannot view timeseries statistic if admin account is inactive.
    """

    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Simulate admin suspension
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_admin.status = suspended_status
    db_session.commit()

    # Hit time series statistic, timeframe is 7 days
    response = client.get(
        "/api/admin/statistics/timeseries?timeframe=7", headers=headers
    )

    # Forbidden
    assert response.status_code == 403


# US 16 Scenario 3: Insufficient Privileges
def test_admin_view_timeseries_statistics_insufficient_privileges(
    client, seed_user, get_auth_headers
):
    """
    Tests that an admin with insufficient privileges cannot view timeseries statistic.
    """

    # Usual user login
    headers = get_auth_headers(seed_user.id)

    # Hit time series statistic, timeframe is 7 days
    response = client.get(
        "/api/admin/statistics/timeseries?timeframe=7", headers=headers
    )

    # Forbidden
    assert response.status_code == 403


# US 1 Scenario 1: View all pending invitations
def test_admin_view_all_invitaions(
    client, seed_admin, get_auth_headers, seed_invitation
):
    """
    Tests that an admin can view all invitations.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all invitations
    response = client.get("/api/admin/invitations", headers=headers)

    # Success
    assert response.status_code == 200

    invitations = response.json()
    assert len(invitations) == 1
    assert invitations[0]["recipient_email"] == seed_invitation.recipient_email


def test_admin_view_all_invitations_with_filter(
    client, seed_admin, get_auth_headers, seed_invitation
):
    """
    Tests that an admin can view all invitations with filers.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all invitations
    response = client.get(
        f"/api/admin/invitations?email={seed_invitation.recipient_email}&status=PENDING&limit=10&offset=0",
        headers=headers,
    )

    # Success
    assert response.status_code == 200

    invitations = response.json()
    assert len(invitations) == 1
    assert invitations[0]["recipient_email"] == seed_invitation.recipient_email


def test_admin_view_all_reservations(
    client, seed_admin, get_auth_headers, seed_reservation
):
    """
    Tests that an admin can view all reservations.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all reservations
    response = client.get("/api/admin/reservations", headers=headers)

    # Success
    assert response.status_code == 200

    reservations = response.json()
    assert len(reservations) == 1
    assert reservations[0]["tool_id"] == str(seed_reservation.tool_id)


def test_admin_view_all_reservations_with_filter(
    client, seed_admin, get_auth_headers, seed_reservation
):
    """
    Tests that an admin can view all reservations with filters.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all reservations
    response = client.get(
        f"/api/admin/reservations?user_id={str(seed_reservation.borrower_id)}&status=REQUESTED&limit=10&offset=0",
        headers=headers,
    )

    # Success
    assert response.status_code == 200

    reservations = response.json()
    assert len(reservations) == 1
    assert reservations[0]["tool_id"] == str(seed_reservation.tool_id)


def test_admin_view_all_tools(client, seed_admin, get_auth_headers, seed_tool):
    """
    Tests that an admin can view all tools.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all tools
    response = client.get("/api/admin/tools", headers=headers)

    # Success
    assert response.status_code == 200

    tools = response.json()
    assert len(tools) == 1
    assert tools[0]["tool_id"] == str(seed_tool.id)


def test_admin_view_all_tool_with_filter(
    client, seed_admin, get_auth_headers, seed_tool
):
    """
    Tests that an admin can view all tools with filters.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all tools
    response = client.get(
        f"/api/admin/tools?user_id={str(seed_tool.owner_id)}&\
        tool_id={str(seed_tool.id)}&status=AVAILABLE&tool_type={seed_tool.tool_type.code}&\
        tool_condition={seed_tool.condition}&search={seed_tool.title}&limit=10&offset=0",
        headers=headers,
    )

    # Success
    assert response.status_code == 200

    tools = response.json()
    assert len(tools) == 1
    assert tools[0]["tool_id"] == str(seed_tool.id)


def test_admin_view_all_users(client, seed_admin, get_auth_headers):
    """
    Tests that an admin can view all users.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all users
    response = client.get("/api/admin/users", headers=headers)

    # Success
    assert response.status_code == 200

    users = response.json()
    # Without seed tool or seed_reservation there is only one admin
    assert len(users) == 1
    assert users[0]["user_id"] == str(seed_admin.id)


def test_admin_view_all_users_with_filter(client, seed_admin, get_auth_headers):
    """
    Tests that an admin can view all users with filters.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit view all users
    response = client.get(
        f"/api/admin/users?user_id={str(seed_admin.id)}&status=ACTIVE&limit=10&offset=0",
        headers=headers,
    )

    # Success
    assert response.status_code == 200

    users = response.json()
    assert len(users) == 1
    assert users[0]["user_id"] == str(seed_admin.id)


# US 1 Scenario 2: Revoke a pending invitation
def test_admin_revoke_invitation(client, seed_admin, get_auth_headers, seed_invitation):
    """
    Tests that an admin can revoke an invitation.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    assert seed_invitation.status == InvitationStatus.PENDING
    # Hit revoke an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/revoke", headers=headers
    )

    # Success
    assert response.status_code == 200
    assert seed_invitation.status == InvitationStatus.REVOKED


# US 1 Scenario 3: Resend an expired invitation
def test_admin_resend_invitation(
    client, db_session: Session, seed_admin, get_auth_headers, seed_invitation
):
    """
    Tests that an admin can resend an invitation.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Expire the invitation
    seed_invitation.status = InvitationStatus.EXPIRED
    db_session.commit()

    assert seed_invitation.status == InvitationStatus.EXPIRED

    # Hit resend an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/resend", headers=headers
    )

    # Success
    assert response.status_code == 200
    assert seed_invitation.status == InvitationStatus.PENDING


# US 1 Scenario 4: Invitation already accepted
def test_admin_revoke_used_invitation(
    client, db_session: Session, seed_admin, get_auth_headers, seed_invitation
):
    """
    Tests that an admin cannot revoke an invitation that has already been accepted.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Used invitation
    seed_invitation.status = InvitationStatus.USED
    db_session.commit()

    assert seed_invitation.status == InvitationStatus.USED

    # Hit revoke an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/revoke", headers=headers
    )

    # Bad Request
    assert response.status_code == 400
    assert seed_invitation.status == InvitationStatus.USED


# US 1 Scenario 4: Invitation already accepted
def test_admin_resend_used_invitation(
    client, db_session: Session, seed_admin, get_auth_headers, seed_invitation
):
    """
    Tests that an admin cannot resend an invitation that has already been accepted.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Used invitation
    seed_invitation.status = InvitationStatus.USED
    db_session.commit()

    assert seed_invitation.status == InvitationStatus.USED

    # Hit resend an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/resend", headers=headers
    )

    # Bad Request
    assert response.status_code == 400
    assert seed_invitation.status == InvitationStatus.USED


# US 1 Scenario 5: Insufficient privileges
def test_revoke_invitation_insufficient_privileges(
    client, seed_user, get_auth_headers, seed_invitation
):
    """
    Tests that a user with insufficient privileges cannot revoke an invitation.
    """
    # User login
    headers = get_auth_headers(seed_user.id)

    # Hit revoke an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/revoke", headers=headers
    )

    # Forbidden
    assert response.status_code == 403


# US 1 Scenario 5: Insufficient privileges
def test_resend_invitation_insufficient_privileges(
    client, seed_user, get_auth_headers, seed_invitation
):
    """
    Tests that a user with insufficient privileges cannot resend an invitation.
    """
    # User login
    headers = get_auth_headers(seed_user.id)

    # Hit resend an invitation
    response = client.post(
        f"/api/admin/invitations/{str(seed_invitation.id)}/resend", headers=headers
    )

    # Forbidden
    assert response.status_code == 403


# US 1 Scenario 6: Not logged in
def test_revoke_invitation_not_logged_in(client, seed_invitation):
    """
    Tests that an admin who is not logged in cannot revoke an invitation.
    """
    # Admin is not logged in

    # Hit revoke an invitation
    response = client.post(f"/api/admin/invitations/{str(seed_invitation.id)}/revoke")

    # Unauthorized
    assert response.status_code == 401


# US 1 Scenario 6: Not logged in
def test_resend_invitaion_not_logged_in(client, seed_invitation):
    """
    Tests that an admin who is not logged in cannot resend an invitation.
    """
    # Admin is not logged in

    # Hit resend an invitation
    response = client.post(f"/api/admin/invitations/{str(seed_invitation.id)}/resend")

    # Unauthorized
    assert response.status_code == 401


def test_admin_view_reports(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin can view reports.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Place a report
    report = Report(
        description="Test report",
        reporter_id=seed_admin.id,
        status=ReportStatus.ACTIVE,
        target_id=str(seed_user.id),
        target_type=ReportTargetType.USER,
        category=ReportCategory.INAPPROPRIATE_BEHAVIOR,
    )
    db_session.add(report)
    db_session.commit()

    # Hit get ACTIVE reports
    response = client.get(
        "/api/admin/reports?status=ACTIVE&limit=10&offset=0", headers=headers
    )

    # Success
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) == 1
    assert reports[0]["id"] == str(report.id)
    assert reports[0]["description"] == report.description


def test_admin_resolve_report(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin can resolve a report.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Place a report
    report = Report(
        description="Test report",
        reporter_id=seed_admin.id,
        status=ReportStatus.ACTIVE,
        target_id=str(seed_user.id),
        target_type=ReportTargetType.USER,
        category=ReportCategory.INAPPROPRIATE_BEHAVIOR,
    )
    db_session.add(report)
    db_session.commit()

    assert report.status == ReportStatus.ACTIVE

    # Hit resolve report
    response = client.post(
        f"/api/admin/reports/{str(report.id)}/resolve", headers=headers
    )

    # Success
    assert response.status_code == 200

    assert report.status == ReportStatus.RESOLVED


def test_admin_resolve_report_not_exist(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot resolve a report that does not exist.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit resolve report
    response = client.post(
        f"/api/admin/reports/{str('e0000000-0000-0000-0000-000000000999')}/resolve",
        headers=headers,
    )

    # Not found
    assert response.status_code == 404


def test_admin_resolve_resolved_report(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin cannot resolve a report that is already resolved.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Place a report
    report = Report(
        description="Test report",
        reporter_id=seed_admin.id,
        status=ReportStatus.RESOLVED,
        target_id=str(seed_user.id),
        target_type=ReportTargetType.USER,
        category=ReportCategory.INAPPROPRIATE_BEHAVIOR,
    )
    db_session.add(report)
    db_session.commit()

    assert report.status == ReportStatus.RESOLVED

    # Hit resolve report
    response = client.post(
        f"/api/admin/reports/{str(report.id)}/resolve", headers=headers
    )

    # Bad request
    assert response.status_code == 400
    assert report.status == ReportStatus.RESOLVED


def test_admin_reacrivate_report(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin can reactivate a report.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Place a report
    report = Report(
        description="Test report",
        reporter_id=seed_admin.id,
        status=ReportStatus.RESOLVED,
        target_id=str(seed_user.id),
        target_type=ReportTargetType.USER,
        category=ReportCategory.INAPPROPRIATE_BEHAVIOR,
    )
    db_session.add(report)
    db_session.commit()

    assert report.status == ReportStatus.RESOLVED

    # Hit reactivate report
    response = client.post(
        f"/api/admin/reports/{str(report.id)}/activate", headers=headers
    )

    # Success
    assert response.status_code == 200
    assert report.status == ReportStatus.ACTIVE


def test_admin_activate_active_report(
    client, db_session: Session, seed_user, seed_admin, get_auth_headers
):
    """
    Tests that an admin cannot reactivate a report that is already active.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Place a report
    report = Report(
        description="Test report",
        reporter_id=seed_admin.id,
        status=ReportStatus.ACTIVE,
        target_id=str(seed_user.id),
        target_type=ReportTargetType.USER,
        category=ReportCategory.INAPPROPRIATE_BEHAVIOR,
    )
    db_session.add(report)
    db_session.commit()

    assert report.status == ReportStatus.ACTIVE

    # Hit reactivate report
    response = client.post(
        f"/api/admin/reports/{str(report.id)}/activate", headers=headers
    )

    # Bad request
    assert response.status_code == 400
    assert report.status == ReportStatus.ACTIVE


def test_admin_activate_not_existing_report(client, seed_admin, get_auth_headers):
    """
    Tests that an admin cannot reactivate a report that does not exist.
    """
    # Admin login
    headers = get_auth_headers(seed_admin.id)

    # Hit reactivate report
    response = client.post(
        f"/api/admin/reports/{str('e0000000-0000-0000-0000-000000000999')}/activate",
        headers=headers,
    )

    # Not found
    assert response.status_code == 404
