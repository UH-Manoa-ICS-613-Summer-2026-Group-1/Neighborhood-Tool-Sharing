import pytest
from sqlalchemy.orm import Session
from app.models.user import User

# Seed user data={
# "email": "someemail@mail.com", 
# "password": "Correctpassword123!",
# "name": "Test User", 
# "status_id": 1,                       Active
# "role_id": 1}                         User

# 'db_session' is a fixture that provides a session for interacting with the test database. 
# It wipes and rebuilds all database tables before the test.

# 'client' is a fixture that provides a TestClient instance for making requests.
# It overrides the get_db dependency to use a test database session.
# 'client' fixture takes 'db_session' as a dependency. Therefore, whenever you include 'client' in a test,
# the database is automatically clean first.


def test_login_success(client, seed_user):
    """
    Test that valid credentials return a JWT token and bearer type.
    """  
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, seed_user):
    """
    Test that invalid credentials return a 401 unauthorized error.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Wrongpassword123!"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."

def test_protected_route_without_token(client):
    """
    Test that accessing a protected route without a token fails.
    """
    response = client.get("/api/auth/protected-profile")  
    assert response.status_code == 401

def test_protected_route_with_token(client, seed_user):
    """
    Test that accessing a protected route with a valid token succeeds.
    """
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"}
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

def test_register_success(client, db_session: Session):
    """
    Test that a new user can register successfully with a new email.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "newuser@mail.com", "password": "Securepassword123!"}
    )

    assert response.status_code == 201
    assert response.json()["message"] == "User registered successfully."
    
    user_in_db = db_session.query(User).filter(User.email == "newuser@mail.com").first()
    assert user_in_db is not None

def test_register_duplicate_email(client, seed_user):
    """
    Test that a user cannot register an email that already exists.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "someemail@mail.com", "password": "SomeValidPassword1!"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email is already registered."