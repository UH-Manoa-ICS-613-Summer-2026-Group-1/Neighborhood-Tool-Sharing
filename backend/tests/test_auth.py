import time

import jwt
from app.models.user import User, UserStatus
from app.utils.auth_helpers import ALGORITHM, SECRET_KEY
from sqlalchemy.orm import Session

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "first_name"="UserFirst",
# "last_name"="UserLast",
# "status_id": 1,                       Active
# "role_id": 1}                         User

# Seed suspended user data={
# "email": "somesuspendedemail@mail.com",
# "password": "Correctpassword123!",
# first_name="Firstname Test Suspended User",
# last_name="Lastname Test Suspended User",
# "status_id": 2,                       Suspended
# "role_id": 1}                         User

# Seed invitaion data={
# "sender_id": seed_user.id,
# "recipient_email": "newuser@mail.com",
# "invitation_token": "valid-invite-token",
# "status": "PENDING"}


# US 17 Scenario 1: Successful login
def test_login_success(client, seed_user):
    """
    Test that valid credentials return a JWT token and bearer type.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# US 17 Scenario 2: Incorrect credentials
def test_login_wrong_password(client, seed_user):
    """
    Test that invalid password return a 401 unauthorized error.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Wrongpassword123!"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


# US 17 Scenario 2: Incorrect credentials
def test_login_wrong_email(client, seed_user):
    """
    Test that invalid email return a 401 unauthorized error.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "notexistingemail@mail.com", "password": "Correctpassword123!"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


# US 17 Scenario 3: Incomplete login form
def test_incomplete_login_data_email(client, seed_user):
    """
    Test that incomplete login data returns a 422 unprocessable entity error.
    """
    response = client.post(
        "/api/auth/login", json={"email": "someemail@mail.com", "password": ""}
    )
    assert response.status_code == 422


# US 17 Scenario 3: Incomplete login form
def test_incomplete_login_data_pw(client, seed_user):
    """
    Test that incomplete login data returns a 422 unprocessable entity error.
    """
    response = client.post(
        "/api/auth/login", json={"email": "", "password": "Correctpassword123!"}
    )
    assert response.status_code == 422


# US 17 Scenario 4: Successful logout
def test_logout_success(client, seed_user):
    """
    Test that logging out blocks the token from future requests.
    """
    # Log in to get a token
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Logout
    logout_response = client.post("/api/auth/logout", headers=headers)
    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Successfully logged out."

    # Try to access a protected profile using the same token
    login2_response = client.get("/api/users/me", headers=headers)

    assert login2_response.status_code == 401
    assert login2_response.json()["detail"] == "Token has been revoked (logged out)."
    assert login_response.headers


# US 17 Scenario 5: Accessing protected pages
def test_protected_route_without_token(client):
    """
    Test that accessing a protected route without a token fails.
    """
    response = client.get("/api/users/me")
    assert response.status_code == 401


# US 17 Scenario 5: Accessing protected pages
def test_protected_route_with_expired_token(client, seed_user):
    """
    Test that accessing a protected route with an expired token fails.
    """
    # Create an expired token
    expired_payload = {
        "sub": str(seed_user.id),
        "jti": "some-test-jti-uuid",
        "exp": time.time() - 1,
    }

    # Encode it
    expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)

    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired. Please log in again."


# US 17 Scenario 5: Accessing protected pages
def test_protected_route_with_token(db_session: Session, client, seed_user):
    """
    Test that accessing a protected route with a valid token succeeds.
    """
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    token = login_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/users/me", headers=headers)

    profile = response.json()

    db_session.refresh(seed_user)
    assert response.status_code == 200
    assert profile["user_email"] == seed_user.email
    assert profile["user_first_name"] == seed_user.first_name
    assert profile["user_last_name"] == seed_user.last_name
    assert profile["status_code"] == seed_user.status.code
    assert profile["role_code"] == seed_user.role.code

    assert "password" not in profile


# US 17 Scenario 6: Suspended user
def test_suspended_user_login(client, seed_suspended_user):
    """
    Test that a suspended user cannot log in.
    """
    response = client.post(
        "/api/auth/login",
        json={
            "email": "somesuspendedemail@mail.com",
            "password": "Correctpassword123!",
        },
    )

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Your account has been suspended. Please contact support."
    )


# US 17 Scenario 6: Suspended user
def test_protected_route_suspended_user(client, seed_user, db_session: Session):
    """
    Test that a suspended user's token is rejected.
    """
    # Log in to get a valid token while active
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    token = login_response.json()["access_token"]

    # Simulate an admin suspending the user (will be a route later)
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    # Try to access the protected route
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Your account has been suspended. Please contact support."
    )


# US 11. Scenario 1: Invitation link valid (validation + registration)
def test_register_success(client, db_session: Session, seed_invitation):
    """
    Test that a new user can register successfully with a new email.
    Invitation seed recipient email is "newuser@mail.com"
    """

    # There is a new invite
    assert seed_invitation is not None
    invite_token = seed_invitation.invitation_token

    # Validate the invite token
    validate_invite_token_response = client.get(
        "/api/invitations/validate?token=" + invite_token,
    )
    # Token is valid
    assert validate_invite_token_response.status_code == 200
    assert (
        validate_invite_token_response.json()["recipient_email"] == "newuser@mail.com"
    )

    # Ensure the user does not already exist
    existing_user = (
        db_session.query(User).filter(User.email == "newuser@mail.com").first()
    )
    assert existing_user is None

    # Register the new user
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@mail.com",
            "password": "Securepassword123!",
            "first_name": "User First Name",
            "last_name": "User Last Name",
            "invite_token": invite_token,
        },
    )

    # User is registered
    assert register_response.status_code == 201
    assert register_response.json()["message"] == "User registered successfully."

    # User is in the database
    user_in_db = db_session.query(User).filter(User.email == "newuser@mail.com").first()
    assert user_in_db is not None


# US 11. Scenario 2: Invitation link invalid
def test_register_invalid_invitation(client):
    """
    Test that attempting to register with an invalid invite token is rejected.
    """
    fake_token = "this-token-does-not-exist-in-db"

    # Test that validating the fake token fails
    validate_response = client.get(f"/api/invitations/validate?token={fake_token}")
    assert validate_response.status_code == 404
    assert (
        validate_response.json()["detail"]
        == "This invitation link is invalid or does not exist. Please request a new invitation."
    )

    # Test that attempting to register with this fake token is rejected
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@mail.com",
            "password": "SomeValidPassword1!",
            "first_name": "User First Name",
            "last_name": "User Last Name",
            "invite_token": fake_token,
        },
    )
    assert register_response.status_code == 404
    assert (
        register_response.json()["detail"]
        == "This invitation link is invalid or does not exist. Please request a new invitation."
    )


# US 11. Scenario 3: User already exists
def test_register_duplicate_email(client, db_session: Session, seed_invitation):
    """
    Test that a user cannot register an email that already exists.
    Invitation seed recipient email is "newuser@mail.com"
    """

    invite_token = seed_invitation.invitation_token

    # First registration
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@mail.com",
            "password": "SomeValidPassword1!",
            "first_name": "User First Name",
            "last_name": "User Last Name",
            "invite_token": invite_token,
        },
    )

    # User is registered
    assert register_response.status_code == 201

    # Second registration with the same email
    register_response2 = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@mail.com",
            "password": "SomeValidPassword2!",
            "first_name": "New User First Name",
            "last_name": "New User Last Name",
            "invite_token": invite_token,
        },
    )

    # User is not registered
    assert register_response2.status_code == 400


# US 11. Scenario 4: Invitation link has expired
def test_register_expired_invitation(client, db_session: Session, seed_invitation):
    """
    Test that attempting to register with an expired invite token is rejected.
    """
    invite_token = seed_invitation.invitation_token

    # Set the token to expired
    seed_invitation.status = "EXPIRED"
    db_session.commit()

    # Verify validation endpoint catches the expiration flag
    validate_response = client.get(f"/api/invitations/validate?token={invite_token}")
    assert validate_response.status_code == 400
    assert (
        validate_response.json()["detail"]
        == "This invitation link has expired. Please request a new invitation."
    )

    # Verify registration endpoint catches the expiration flag
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@mail.com",
            "password": "SomeValidPassword1!",
            "first_name": "User First Name",
            "last_name": "User Last Name",
            "invite_token": invite_token,
        },
    )
    assert register_response.status_code == 400
    assert (
        register_response.json()["detail"]
        == "This invitation link has expired. Please request a new invitation."
    )
