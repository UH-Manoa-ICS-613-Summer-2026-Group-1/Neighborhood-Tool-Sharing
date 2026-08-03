"""
Authentication routers.
Handles registration, login, logout, and password reset.
"""

from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.blocklist import TOKEN_BLOCKLIST
from app.database import get_db
from app.models.invitation import InvitationStatus
from app.models.notification import NotificationCategory
from app.models.password_reset import PasswordReset, PasswordResetStatus
from app.models.user import User, UserRole, UserStatus
from app.routers.invitation import get_valid_invite
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.common import DetailError, MessageResponse
from app.schemas.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordSubmitRequest,
    ResetPasswordValidateResponse,
)
from app.utils.auth_helpers import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.utils.email import send_reset_password_email
from app.utils.notification_helpers import create_notification
from app.utils.token_generator import generate_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

security_scheme = HTTPBearer()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageResponse,
    responses={400: {"model": DetailError}, 404: {"model": DetailError}},
)
def register(user_data: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new user account.
    """
    invite = get_valid_invite(user_data.invite_token, db)

    if invite.recipient_email.lower() != user_data.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. This invitation link was issued to a different email address.",
        )

    # Check if user already exists in the database
    user = db.query(User).filter(User.email == user_data.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    # Get default role and status
    default_role = db.query(UserRole).filter(UserRole.code == "USER").first()
    default_status = db.query(UserStatus).filter(UserStatus.code == "ACTIVE").first()

    # Handle middle name is empty string
    middle_name = None
    if user_data.middle_name is not None:
        middle_name = user_data.middle_name if user_data.middle_name != "" else None

    # Hash password
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        middle_name=middle_name,
        status=default_status,  # ACTIVE status
        role=default_role,  # USER role
    )

    try:
        # Add the new user to the database
        db.add(new_user)

        # flush() to get the new_user.id
        db.flush()
        # Set invite token status to USED
        invite.status = InvitationStatus.USED

        invite.recipient_id = new_user.id

        # Add a welcome notification for the new user
        create_notification(
            db=db,
            recipient_id=new_user.id,
            category=NotificationCategory.SYSTEM,
            title="Welcome!",
            content=f"Hello {new_user.first_name} {new_user.last_name}! We're excited to have you join our community.",
        )

        # Add a confirmation notification for the user who sent the invite to let them know that the invite has been used
        create_notification(
            db=db,
            recipient_id=invite.sender_id,
            category=NotificationCategory.INVITATION,
            title="Invitation used",
            content=f"The invitation for {new_user.first_name} {new_user.last_name} has been used.",
            target_id=new_user.id,
            target_type="USER",
        )

        db.commit()

        return {"message": "User registered successfully."}

    except Exception as e:
        print(f"Registration failed: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def login(credentials: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Login to application.
    """
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Check if the user is suspended
    if user.status.code == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )

    # Generate JWT containing the user's id address as the "sub"
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post(
    "/logout", response_model=MessageResponse, responses={401: {"model": DetailError}}
)
def logout(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    """
    Logout of application.
    """
    # JWT
    token = credentials.credentials
    try:
        # Decode the JWT
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"verify_exp": False},  # Do not check if the token is expired
        )

    # If the token is invalid raise an exception
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token provided."
        )

    # payload contains {sub: user_id, exp: expiration_time, jti: uuid}.
    jti = payload.get("jti")
    user_id = payload.get("sub")

    # If JTI or user_id is None in the payload raise an exception
    if jti is None or user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token provided."
        )

    # If JTI is in the blocklist raise an exception
    if jti in TOKEN_BLOCKLIST:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked (logged out).",
        )

    # Add JTI to the blocklist when the user logs out
    TOKEN_BLOCKLIST.add(jti)

    return {"message": "Successfully logged out."}


def get_valid_password_reset(token: str, db: Session) -> PasswordReset:
    """
    Validates a password reset token against all business rules.
    Returns the PasswordReset record if valid, otherwise raises an HTTPException.
    """
    # Fetch reset record
    reset = db.query(PasswordReset).filter(PasswordReset.reset_token == token).first()

    # Token does not exist
    if not reset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The password reset link is invalid or does not exist. Please request a new link.",
        )

    # Token already used
    if reset.status == PasswordResetStatus.USED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has already been used.",
        )

    # Token expired
    if reset.status == PasswordResetStatus.EXPIRED or (
        datetime.now(timezone.utc) > reset.expires_at.replace(tzinfo=timezone.utc)
    ):
        if reset.status != PasswordResetStatus.EXPIRED:
            reset.status = PasswordResetStatus.EXPIRED
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired. Please request a new link.",
        )

    return reset


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def forgot_password(
    user_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Generate a password reset link and email it to the user.
    """
    email = user_data.email

    user = db.query(User).filter(func.lower(User.email) == email.lower()).first()

    # Email not registered -> return success without sending email
    if not user:
        return {"message": f"The reset link has been sent to {email}."}

    # Invalidate existing pending tokens for this user
    existing_resets = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.user_id == user.id,
            PasswordReset.status == PasswordResetStatus.PENDING,
        )
        .all()
    )
    # Set all existing pending tokens to expired
    for old_reset in existing_resets:
        old_reset.status = PasswordResetStatus.EXPIRED

    # Generate a new reset token
    reset_token = generate_token()
    new_reset = PasswordReset(
        user_id=user.id,
        reset_token=reset_token,
        status=PasswordResetStatus.PENDING,
    )

    db.add(new_reset)
    try:
        # Try to commit, if successful send email
        db.commit()
        send_reset_password_email(email, reset_token)
    except Exception as e:
        db.rollback()
        print(f"Failed to send password reset email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email. Please try again later.",
        )

    return {"message": f"The reset link has been sent to {email}."}


@router.get(
    "/reset-password/validate",
    response_model=ResetPasswordValidateResponse,
    responses={400: {"model": DetailError}, 404: {"model": DetailError}},
)
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    """
    Check if a reset password token is valid and not expired.
    """
    reset = get_valid_password_reset(token, db)
    return ResetPasswordValidateResponse(email=reset.user.email)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    responses={400: {"model": DetailError}, 404: {"model": DetailError}},
)
def reset_password(
    reset_data: ResetPasswordSubmitRequest,
    db: Session = Depends(get_db),
):
    """
    Reset user password using the provided reset token.
    """
    # Validate Token
    reset = get_valid_password_reset(reset_data.reset_token, db)

    # Retrieve user record
    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this reset password request was not found.",
        )

    # Update user password and deactivate the reset link
    user.password = get_password_hash(reset_data.new_password)
    reset.status = PasswordResetStatus.USED

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to update user password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user password. Please try again later.",
        )
    return {
        "message": "Password reset successful. You can now log in with your new password."
    }
