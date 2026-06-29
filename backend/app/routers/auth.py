"""
Authentication routers.
Handles registration, login, logout.
"""

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.blocklist import TOKEN_BLOCKLIST
from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import (
    DetailError,
    MessageResponse,
    ProtectedProfileResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.utils.auth_helpers import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.utils.dependencies import get_current_user

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

security_scheme = HTTPBearer()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageResponse,
    responses={400: {"model": DetailError}},
)
def register(user_data: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new user account.
    """
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

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password=hashed_password,
        name=user_data.email.split("@")[0],  # Temporary name
        status=default_status,  # ACTIVE status
        role=default_role,  # USER role
    )

    db.add(new_user)
    db.commit()

    return {"message": "User registered successfully."}


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


# A test route
@router.get(
    "/protected-profile",
    response_model=ProtectedProfileResponse,
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def get_profile(current_user: User = Depends(get_current_user)):
    """
    This route is locked! Only users passing a valid JWT can see it.
    """
    return {
        "message": "Access granted! You are inside a locked route.",
        "user_details": current_user,
    }
