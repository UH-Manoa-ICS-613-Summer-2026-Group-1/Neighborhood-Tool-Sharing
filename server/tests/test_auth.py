import pytest

from fastapi.testclient import TestClient

from app.main import app  
from app.routers.auth import get_password_hash 
from app.database import USER_DB

client = TestClient(app)

@pytest.fixture() 
def user():
    """
    Seeds the mock user.
    """
    USER_DB.clear() # Clear before because some tests do not use this user fixture

    USER_DB["someemail@mail.com"] = {
        "email": "someemail@mail.com",
        "hashed_password": get_password_hash("correctpassword")
    }
    yield 
    USER_DB.clear() # Clear after test

def test_login_success(user):
    """
    Test that valid credentials return a JWT token and bearer type.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "correctpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(user):
    """
    Test that invalid credentials return a 401 unauthorized error and correct message.
    """
    response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_protected_route_without_token(user):
    """
    Test that accessing a protected route without a token fails.
    """
    response = client.get("/api/auth/protected-profile")  
    assert response.status_code == 401

def test_protected_route_with_token(user):
    """
    Test that accessing a protected route with a valid token succeeds.
    """
    login_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "correctpassword"}
    )
    token = login_response.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/protected-profile", headers=headers)
    
    assert response.status_code == 200
    assert response.json()["user_details"]["email"] == "someemail@mail.com"


def test_register_success():
    """
    Test that a new user can register successfully with a new email.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "newuser@mail.com", "password": "securepassword123"}
    )
    assert response.status_code == 201
    assert response.json()["message"] == "User registered successfully!"
    assert "newuser@mail.com" in USER_DB

def test_register_duplicate_email(user):
    """
    Test that a user cannot register an email that already exists.
    """
    response = client.post(
        "/api/auth/register",
        json={"email": "someemail@mail.com", "password": "somepassword"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email is already registered"