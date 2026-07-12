from app.models.photo import Photo
from sqlalchemy.orm import Session

from tests.conftest import get_auth_headers

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "first_name"="UserFirst",
# "last_name"="UserLast",
# "status_id": 1,                       Active
# "role_id": 1}                         User


def test_get_user_profile_returns_correct_data(client, db_session: Session, seed_user):
    """
    Test that the user profile endpoint returns the correct data
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Hit get user profile
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 200
    user_data = response.json()

    assert user_data["user_first_name"] == "UserFirst"
    assert user_data["user_last_name"] == "UserLast"
    assert user_data["user_middle_name"] is None
    assert user_data["user_photo_url"] is None


def test_patch_profile_names_and_add_photo(client, db_session: Session, seed_user):
    """
    Test that update user profile endpoint changes the user data
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "last_name": "UpdatedLastName",
        "photo_url": "NEW_PHOTO_URL",
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.last_name == "UpdatedLastName"
    assert seed_user.photo.url == "NEW_PHOTO_URL"


def test_patch_profile_add_and_then_delete_photo(client, seed_user):
    """
    Test that update user profile endpoint add and then delete photo
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # There is no user photo
    assert seed_user.photo_id is None

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "photo_url": "NEW_PHOTO_URL",
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.photo_id is not None
    assert seed_user.photo.url == "NEW_PHOTO_URL"

    patch_payload = {
        "photo_url": None,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.photo_id is None
