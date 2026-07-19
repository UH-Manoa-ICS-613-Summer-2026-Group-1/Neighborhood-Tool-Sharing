from app.models.user import UserStatus
from app.utils.storage import DUMMY_IMAGE_URL
from sqlalchemy.orm import Session

# Seed user data={
# "email": "someemail@mail.com",
# "password": "Correctpassword123!",
# "first_name"="UserFirst",
# "last_name"="UserLast",
# "status_id": 1,                       Active
# "role_id": 1}                         User


def test_get_user_profile_returns_correct_data(
    client, db_session: Session, seed_user, get_auth_headers
):
    """
    Test that the user profile endpoint returns the correct data.
    """
    # Login
    headers = get_auth_headers(seed_user.id)

    # Hit get user profile
    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 200
    user_data = response.json()

    assert user_data["user_first_name"] == "UserFirst"
    assert user_data["user_last_name"] == "UserLast"
    assert user_data["user_middle_name"] is None
    assert user_data["user_photo_url"] is None


# US 18. Scenario 1: Successful updating the profile
def test_patch_profile_names_and_add_photo(
    client, db_session: Session, seed_user, get_auth_headers
):
    """
    Test that update user profile endpoint changes the user data.
    """
    # Login
    headers = get_auth_headers(seed_user.id)

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "last_name": "UpdatedLastName",
        "photo_url": DUMMY_IMAGE_URL,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    db_session.refresh(seed_user)
    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.last_name == "UpdatedLastName"
    assert seed_user.photo.url == DUMMY_IMAGE_URL


# US 18. Scenario 1: Successful updating the profile
def test_patch_profile_add_and_then_delete_photo(
    db_session: Session, client, seed_user, get_auth_headers
):
    """
    Test that update user profile endpoint add and then delete photo.
    """
    # Login
    headers = get_auth_headers(seed_user.id)

    # There is no user photo
    assert seed_user.photo_id is None

    patch_payload = {
        "first_name": "UpdatedFirstName",
        "photo_url": DUMMY_IMAGE_URL,
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    db_session.refresh(seed_user)
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

    db_session.refresh(seed_user)
    # There is no user photo
    assert response.status_code == 200
    assert seed_user.first_name == "UpdatedFirstName"
    assert seed_user.photo_id is None


# US 18. Scenario 1: Successful updating the profile
def test_change_password_success(client, seed_user, get_auth_headers):
    """
    Test that a user can successfully change their password.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "current_password": "Correctpassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }

    response = client.patch(
        "/api/users/me/change-password", json=payload, headers=headers
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password updated successfully."}


def test_change_password_incorrect_current(client, seed_user, get_auth_headers):
    """
    Test that a user cannot change their password with an incorrect current password.
    """
    headers = get_auth_headers(seed_user.id)

    payload = {
        "current_password": "WrongCurrentPassword123!",
        "new_password": "BrandNewSecurePassword789!",
    }

    response = client.patch(
        "/api/users/me/change-password", json=payload, headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect current password."


def test_change_password_identical_password_reuse(client, seed_user, get_auth_headers):
    """
    Test that a user cannot change their password to an identical password.
    """
    headers = get_auth_headers(seed_user.id)

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


def test_change_password_validation_error(client, seed_user, get_auth_headers):
    """
    Test that a user cannot change their password with weak password.
    """
    headers = get_auth_headers(seed_user.id)

    # Not valid new password
    invalid_payload = {
        "current_password": "Correctpassword123!",
        "new_password": "weakpasswordqwerty123456",
    }

    response = client.patch(
        "/api/users/me/change-password", json=invalid_payload, headers=headers
    )

    assert response.status_code == 422


def test_can_authenticate_with_new_password_after_change(
    client, seed_user, get_auth_headers
):
    """
    Test that a user can login with new password after changing password. And cannot login with old password.
    """
    headers = get_auth_headers(seed_user.id)

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
    login_with_new_password_response = client.post(
        "/api/auth/login",
        json={"email": "someemail@mail.com", "password": "BrandNewSecurePassword789!"},
    )

    assert login_with_new_password_response.status_code == 200


# US 18. Scenario 2: Invalid text fields
def test_patch_profile_with_invalid_fields(client, seed_user, get_auth_headers):
    """
    Test that update user profile endpoint with invalid fields fails.
    """
    # Login
    headers = get_auth_headers(seed_user.id)

    # The payload omit last_name which ok. The last name will not be updated.
    # The payload provides invalid first_name which not ok. The first name must consist of at least 1 character.
    patch_payload = {
        "first_name": "      ",
    }

    # Update user profile
    response = client.patch("/api/users/me", json=patch_payload, headers=headers)

    assert response.status_code == 422


# US 18. Scenario 3: Uploading invalid photo
def test_updated_profile_with_invalid_image_format(client, seed_user, get_auth_headers):
    """
    Test that the user cannot upload an invalid file.
    """
    # if the image bypass api/upload and in the stroage bucket it means the image is valid
    # patch api/users/me: photo_url request body value must consist of domain name of dev local srotage or production S3 bucket

    headers = get_auth_headers(seed_user.id)

    # No valid domain name
    payload = {"photo_url": "https://malicious_domain_name/malicious_file.exe"}

    # Hit the update user profile endpoint
    response = client.patch("/api/users/me", headers=headers, json=payload)

    # 422 Pydentic schema error
    assert response.status_code == 422
    assert (
        response.json()["detail"][0]["msg"]
        == "Value error, Untrusted image source domain."
    )


# US 18. Scenario 5: Not logged in
def test_patch_profile_unauthorized(client):
    """
    Test that the user cannot change profile being not logged in.
    """
    # Valid payload
    payload = {"first_name": "UpdatedFirstName"}

    # Hit the update user profile endpoint
    response = client.patch("/api/users/me", json=payload)

    # 401: Unauthorized
    assert response.status_code == 401


# Scenario 6: Suspended user
def test_patch_profile_suspended_user(
    db_session: Session, client, seed_user, get_auth_headers
):
    """
    Test that update user profile endpoint fails for suspended user.
    """
    # Login
    headers = get_auth_headers(seed_user.id)

    # Suspend the user
    seed_user.status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    db_session.commit()

    payload = {
        "first_name": "UpdatedFirstName",
    }
    # Update user profile
    response = client.patch("/api/users/me", json=payload, headers=headers)
    # 403: Forbidden
    assert response.status_code == 403
