from datetime import timedelta

from app.models.invitation import Invitation
from app.models.user import User
from sqlalchemy.orm import Session

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "name": "Test User",
# "status_id": 1,                       Active
# "role_id": 1}                         User

# Seed invitaion data={
# "sender_id": seed_user.id,
# "recipient_email": "newuser@mail.com",
# "invitation_token": "valid-invite-token",
# "status": "PENDING"}


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
