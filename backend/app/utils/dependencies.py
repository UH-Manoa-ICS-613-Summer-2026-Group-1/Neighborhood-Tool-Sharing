"""
Dependency injection helpers.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.blocklist import TOKEN_BLOCKLIST
from app.database import get_db
from app.models.user import User
from app.utils.auth_helpers import ALGORITHM, SECRET_KEY

security_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate the JWT and return the authenticated user.
    """
    # JWT
    token = credentials.credentials
    try:
        # Decode the JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    # If the token is expired raise an exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
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

    # If the user does not exist in db raise an exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found."
        )

    # If the user is not active, e.g. suspended, raise an exception
    # Also if the other status codes are added in the future (e.g. DELETED), raise an exception
    if user.status.code != "ACTIVE":
        # If the user is suspended
        if user.status.code == "SUSPENDED":
            detail_msg = "Your account has been suspended. Please contact support."
        # Some other status code that is not ACTIVE or SUSPENDED (e.g. DELETED)
        else:
            detail_msg = (
                f"Access denied. Account status is currently: {user.status.code}."
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail_msg,
        )

    return user
