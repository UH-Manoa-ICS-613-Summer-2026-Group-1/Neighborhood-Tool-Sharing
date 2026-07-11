from datetime import timedelta

from app.models.invitation import Invitation
from app.models.user import User, UserStatus
from sqlalchemy.orm import Session

from tests.conftest import get_auth_headers

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "first_name"="UserFirst",
# "last_name"="UserLast",
# "status_id": 1,                       Active
# "role_id": 1}                         User

# Seed invitaion data={
# "sender_id": seed_user.id,
# "recipient_email": "newuser@mail.com",
# "invitation_token": "valid-invite-token",
# "status": "PENDING"}


# US 12. Scenario 1: User not logged in
def test_send_invitation_unauthorized(client):
    """
    Test that an unauthenticated user cannot send invitations.
    """
    response = client.post(
        "/api/invitations",
        json={"recipient_email": "newuser@mail.com"},
    )
    assert response.status_code == 401


# US 12. Scenario 2: Inactive User Account
def test_send_invitation_inactive_user(client, db_session: Session, seed_user):
    """
    Test that a suspended user cannot send invitations.
    """
    # Log in to get a token while still active
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Simulate an admin suspending the user (will be a route later)
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    # Try sending an invitation
    response = client.post(
        "/api/invitations",
        headers=headers,
        json={"recipient_email": "newuser@mail.com"},
    )
    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Your account has been suspended. Please contact support."
    )


# US 12. Scenario 3: User Account Already Exists
def test_send_invitation_user_already_exists(client, seed_user):
    """
    Test that you cannot send an invitation to an email already registered in the system.
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Attempting to invite 'someemail@mail.com' (which belongs to seed_user)
    response = client.post(
        "/api/invitations",
        headers=headers,
        json={"recipient_email": "someemail@mail.com"},
    )
    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "The email address someemail@mail.com is already associated with an account."
    )


# US 12. Scenario 4: Invalid Email Address
def test_send_invitation_invalid_email(client, seed_user):
    """
    Test that an invalid or poorly formatted string triggers a validation failure.
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Attempting to invite with an invalid email
    response = client.post(
        "/api/invitations",
        headers=headers,
        json={"recipient_email": "invilid_email_address"},
    )
    # 422 code, pydantic schema error
    assert response.status_code == 422


# US 12. Scenario 5: Successful Invitation
def test_send_invitation_success(client, db_session: Session, seed_user):
    """
    Test that a user can send an invitation successfully.
    """
    # Login user, i.e. accaunt is active and valid
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    # Get headers
    jwt_token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {jwt_token}"}
    assert login_response.status_code == 200

    # Email address is not associated with any existing account
    assert (
        db_session.query(User).filter(User.email == "newuser@mail.com").first() is None
    )
    # There are no other pending invitations
    invite = (
        db_session.query(Invitation)
        .filter(Invitation.recipient_email == "newuser@mail.com")
        .first()
    )
    assert invite is None

    # Create a invite token for a new user
    send_invitation_response = client.post(
        "/api/invitations",
        headers=headers,
        json={"recipient_email": "newuser@mail.com"},
    )

    # Email address entered is valid, i.e. no 422 http error
    assert send_invitation_response.status_code == 201

    # Then the invitation record is saved to the database and associated with the sending user
    # Find the invite in the database
    invite = (
        db_session.query(Invitation)
        .filter(Invitation.recipient_email == "newuser@mail.com")
        .first()
    )

    # There is a new invite
    assert invite is not None
    invite_token = invite.invitation_token

    # Validate the invite token
    validate_invite_token_response = client.get(
        "/api/invitations/validate?token=" + invite_token,
    )
    # Token is valid
    assert validate_invite_token_response.status_code == 200

    # And an automated email is sent to that address containing the invitation link
    # No email sending implemented yet.

    # And the invitation link expires after 7 days
    duration = invite.expires_at - invite.created_at
    assert abs(duration - timedelta(days=7)) < timedelta(minutes=1)


# US 12. Scenario 6: Invitation already pending
def test_send_invitation_already_pending(client, seed_user, seed_invitation):
    """
    Test that a duplicate invitation is blocked if a pending one already exists.
    """
    # seed_invitation already specifies recipient_email as "newuser@mail.com" and status "PENDING"
    assert seed_invitation is not None

    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Attempt to invite the exact same email address again
    response = client.post(
        "/api/invitations",
        headers=headers,
        json={"recipient_email": "newuser@mail.com"},
    )
    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "An invitation has already been sent to the email address newuser@mail.com."
    )
