import time

import jwt
from app.models.user import User, UserStatus
from app.utils.auth_helpers import ALGORITHM, SECRET_KEY
from sqlalchemy.orm import Session

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "name": "Test User",
# "status_id": 1,                       Active
# "role_id": 1}                         User

# Seed suspended user data={
# "email": "somesuspendedemail@mail.com",
# "password": "Correctpassword123!",
# "name": "Test Suspended User",
# "status_id": 2,                       Suspended
# "role_id": 1}                         User

# 'db_session' is a fixture that provides a session
#  for interacting with the test database.
# It wipes and rebuilds all database tables before the test.

# 'client' is a fixture that provides a TestClient instance for making requests.
# It overrides the get_db dependency to use a test database session.
# 'client' fixture takes 'db_session' as a dependency.
# Therefore, whenever you include 'client' in a test,
# the database is automatically clean first.


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
    login2_response = client.get("/api/auth/protected-profile", headers=headers)

    assert login2_response.status_code == 401
    assert login2_response.json()["detail"] == "Token has been revoked (logged out)."
    assert login_response.headers


# US 17 Scenario 5: Accessing protected pages
def test_protected_route_without_token(client):
    """
    Test that accessing a protected route without a token fails.
    """
    response = client.get("/api/auth/protected-profile")
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
    response = client.get("/api/auth/protected-profile", headers=headers)

    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired. Please log in again."


# US 17 Scenario 5: Accessing protected pages
def test_protected_route_with_token(client, seed_user):
    """
    Test that accessing a protected route with a valid token succeeds.
    """
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )
    token = login_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/protected-profile", headers=headers)

    user_details = response.json()["user_details"]

    assert response.status_code == 200

    assert user_details["email"] == seed_user.email
    assert user_details["name"] == seed_user.name
    assert user_details["status"]["code"] == seed_user.status.code
    assert user_details["role"]["code"] == seed_user.role.code

    assert "password" not in user_details


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
    response = client.get("/api/auth/protected-profile", headers=headers)

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Your account has been suspended. Please contact support."
    )


# US 11. Will be rebuild after the registration with invitaion is implemented.
def test_register_success(client, db_session: Session):
    """
    Test that a new user can register successfully with a new email.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "newuser@mail.com", "password": "Securepassword123!"},
    )

    assert response.status_code == 201
    assert response.json()["message"] == "User registered successfully."

    user_in_db = db_session.query(User).filter(User.email == "newuser@mail.com").first()
    assert user_in_db is not None


# US 11. Will be rebuild after the registration with invitaion is implemented.
def test_register_duplicate_email(client, seed_user):
    """
    Test that a user cannot register an email that already exists.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "someemail@mail.com", "password": "SomeValidPassword1!"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email is already registered."
