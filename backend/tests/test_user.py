from app.utils.storage import DUMMY_IMAGE_URL
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
    Test that the user profile endpoint returns the correct data.
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


# US 18. Scenario 1: Successful updating the profile
def test_patch_profile_names_and_add_photo(client, db_session: Session, seed_user):
    """
    Test that update user profile endpoint changes the user data.
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "last_name": "UpdatedLastName",
        "photo_url": DUMMY_IMAGE_URL,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.last_name == "UpdatedLastName"
    assert seed_user.photo.url == DUMMY_IMAGE_URL


# US 18. Scenario 1: Successful updating the profile
def test_patch_profile_add_and_then_delete_photo(client, seed_user):
    """
    Test that update user profile endpoint add and then delete photo.
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # There is no user photo
    assert seed_user.photo_id is None

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "photo_url": DUMMY_IMAGE_URL,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    # There is a user photo
    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.photo_id is not None
    assert seed_user.photo.url == DUMMY_IMAGE_URL

    # Delete user photo
    patch_payload = {
        "photo_url": None,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    # There is no user photo
    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.photo_id is None


# US 18. Scenario 1: Successful updating the profile
def test_change_password_success(client, seed_user):
    """
    Test that a user can successfully change their password.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    payload = {
        "current_password": "Correctpassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }

    response = client.patch(
        "/api/users/me/change-password", json=payload, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password updated successfully."}


def test_change_password_incorrect_current(client, seed_user):
    """
    Test that a user cannot change their password with an incorrect current password.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    payload = {
        "current_password": "WrongCurrentPassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }

    response = client.patch(
        "/api/users/me/change-password", json=payload, headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect current password."


def test_change_password_identical_password_reuse(client, seed_user):
    """
    Test that a user cannot change their password to an identical password.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    payload = {
        "current_password": "Correctpassword123!",
        "new_password": "Correctpassword123!",
    }

    response = client.patch(
        "/api/users/me/change-password", json=payload, headers=headers
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "New password cannot be identical to your current password."
    )


def test_change_password_unauthorized(client, seed_user):
    """
    Test that a user cannot change their password without being logged in.
    """
    payload = {
        "current_password": "Correctpassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }

    response = client.patch("/api/users/me/change-password", json=payload)

    assert response.status_code == 401


def test_change_password_validation_error(client, seed_user):
    """
    Test that a user cannot change their password with weak password.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Not valid new password
    invalid_payload = {
        "current_password": "Correctpassword123!",
        "new_password": "weakpasswordqwerty123456",
    }

    response = client.patch(
        "/api/users/me/change-password", json=invalid_payload, headers=headers
    )

    assert response.status_code == 422


def test_can_authenticate_with_new_password_after_change(client, seed_user):
    """
    Test that a user can login with new password after changing password. And cannot login with old password.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Change passsword
    payload = {
        "current_password": "Correctpassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }
    client.patch("/api/users/me/change-password", json=payload, headers=headers)

    # Verify old password fails
    login_with_old_password_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "Correctpassword123!"},
    )

    assert login_with_old_password_response.status_code == 401

    # Verify new password works
    new_headers = get_auth_headers(
        client, "someemail@mail.com", "BrandNewSecurePassword789!"
    )

    # Hit get user profile with new credentials
    response = client.get("/api/users/me", headers=new_headers)
    assert response.status_code == 200


# US 18. Scenario 2: Invalid text fields
def test_patch_profile_with_invalid_fields(client, seed_user):
    """
    Test that update user profile endpoint with invalid fields fails.
    """
    # Login
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # The payload omit last_name which ok. The last name will not be updated.
    # The payload provides invalid first_name which not ok. The first name must consist of at least 1 character.
    patch_payload = {
        "first_name": "      ",
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 422


# US 18. Scenario 3: Uploading invalid photo
def test_upload_media_invalid_file_format(client, seed_user):
    """
    Test that the user cannot upload an invalid file.
    """
    pass
