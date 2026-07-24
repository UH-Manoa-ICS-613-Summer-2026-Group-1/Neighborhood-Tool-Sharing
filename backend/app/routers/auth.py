"""
Authentication routers.
Handles registration, login, logout, and password reset.
"""

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.blocklist import TOKEN_BLOCKLIST
from app.database import get_db
from app.models.invitation import InvitationStatus
from app.models.notification import NotificationCategory
from app.models.user import User, UserRole, UserStatus
from app.routers.invitation import get_valid_invite
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.common import DetailError, MessageResponse
from app.utils.auth_helpers import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.utils.notification_helpers import create_notification

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
            detail=f"Registration failed. Please try again.",
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
