"""
User profile routers.
Handles getting and updating user profiles, changing password.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import (
    User,
    UserProfileView,
)
from app.schemas.common import DetailError, MessageResponse
from app.schemas.user import UserProfileResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_user_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Retrieve a user profile.
    """
    profile = (
        db.query(UserProfileView)
        .filter(UserProfileView.user_id == current_user.id)
        .first()
    )

    # In case broken data raise an error
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User profile data could not be compiled.",
        )

    return profile
