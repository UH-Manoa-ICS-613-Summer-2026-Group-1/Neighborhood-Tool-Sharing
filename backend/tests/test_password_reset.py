from app.models.password_reset import PasswordReset, PasswordResetStatus
from sqlalchemy.orm import Session


# US 24 Scenario 1: Successful requesting a link
def test_successful_requesting_a_link(client, db_session: Session, seed_user):
    """
    Test that a user can successfully request a password reset link.
    """
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": seed_user.email},
    )

    assert response.status_code == 201
    assert response.json() == {
        "message": f"The reset link has been sent to {seed_user.email}."
    }

    # Check if the password reset record exists in the database
    password_reset = (
        db_session.query(PasswordReset)
        .filter(
            PasswordReset.user_id == seed_user.id,
            PasswordReset.status == PasswordResetStatus.PENDING,
        )
        .first()
    )

    assert password_reset is not None


# US 24 Scenario 2: Request a link with not registered email address
def test_request_a_link_with_not_registered_email_address(client, db_session: Session):

    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "not_registered_email@example.com"},
    )

    # Successful response
    assert response.status_code == 201

    # Message
    assert response.json() == {
        "message": "The reset link has been sent to not_registered_email@example.com."
    }

    # But there is no password reset record
    password_resets = db_session.query(PasswordReset).all()
    assert len(password_resets) == 0


# US 24 Scenario 3: Successful password reset
def test_successful_password_reset(client, db_session: Session, seed_user):
    """
    Test that a user can successfully reset their password.
    """
    # Create a password reset record
    new_reset = PasswordReset(
        user_id=seed_user.id,
        reset_token="valid-token-123",
        status=PasswordResetStatus.PENDING,
    )
    db_session.add(new_reset)
    db_session.commit()
    db_session.refresh(new_reset)

    assert new_reset.status == PasswordResetStatus.PENDING

    # Reset password
    response = client.post(
        "/api/auth/reset-password",
        json={"reset_token": new_reset.reset_token, "new_password": "NewPassword1!"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "Password reset successful. You can now log in with your new password."
    }

    assert new_reset.status == PasswordResetStatus.USED


# US 24 Scenario 4: Expired or used link
def test_expired_link(client, db_session: Session, seed_user):
    """
    Test that a user cannot reset their password with expired link.
    """
    # Create expired password reset record
    new_reset = PasswordReset(
        user_id=seed_user.id,
        reset_token="valid-token-123",
        status=PasswordResetStatus.EXPIRED,
    )
    db_session.add(new_reset)
    db_session.commit()
    db_session.refresh(new_reset)

    assert new_reset.status == PasswordResetStatus.EXPIRED

    # Reset password
    response = client.post(
        "/api/auth/reset-password",
        json={"reset_token": new_reset.reset_token, "new_password": "NewPassword1!"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "This password reset link has expired. Please request a new link."
    }
    assert new_reset.status == PasswordResetStatus.EXPIRED


# US 24 Scenario 4: Expired or used link
def test_used_link(client, db_session: Session, seed_user):
    """
    Test that a user cannot reset their password with used link.
    """
    # Create used password reset record
    new_reset = PasswordReset(
        user_id=seed_user.id,
        reset_token="valid-token-123",
        status=PasswordResetStatus.USED,
    )
    db_session.add(new_reset)
    db_session.commit()
    db_session.refresh(new_reset)

    assert new_reset.status == PasswordResetStatus.USED

    # Reset password
    response = client.post(
        "/api/auth/reset-password",
        json={"reset_token": new_reset.reset_token, "new_password": "NewPassword1!"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "This password reset link has already been used."
    }
    assert new_reset.status == PasswordResetStatus.USED


# US 24 Scenario 5: Invalid password
def test_invalid_password_reset(client, db_session: Session, seed_user):
    """
    Test that a user cannot reset their password with invalid password.
    """
    # Create a password reset record
    new_reset = PasswordReset(
        user_id=seed_user.id,
        reset_token="valid-token-123",
        status=PasswordResetStatus.PENDING,
    )
    db_session.add(new_reset)
    db_session.commit()
    db_session.refresh(new_reset)

    assert new_reset.status == PasswordResetStatus.PENDING

    # Reset password
    response = client.post(
        "/api/auth/reset-password",
        json={
            "reset_token": new_reset.reset_token,
            "new_password": "not-valid-password",
        },
    )

    # Pydantic error
    assert response.status_code == 422
    # The reset link still pending
    assert new_reset.status == PasswordResetStatus.PENDING
