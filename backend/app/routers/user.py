"""
User profile routers.
Handles getting and updating user profiles, changing password.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.photo import Photo
from app.models.user import (
    User,
    UserProfileView,
)
from app.schemas.common import DetailError, MessageResponse
from app.schemas.user import (
    ChangePasswordRequest,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from app.utils.auth_helpers import (
    get_password_hash,
    verify_password,
)
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


@router.patch(
    "/me",
    response_model=UserProfileResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def update_user_profile(
    user_details: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a user profile.
    """
    # Handle name
    if user_details.first_name is not None:
        current_user.first_name = user_details.first_name.strip()
    if user_details.last_name is not None:
        current_user.last_name = user_details.last_name.strip()
    if user_details.middle_name is not None:
        current_user.middle_name = user_details.middle_name.strip()

    # Update bio and location
    if user_details.bio is not None:
        current_user.bio = user_details.bio.strip()
    if user_details.location is not None:
        current_user.location = user_details.location.strip()

    # Handle photo url
    # If frontend explicitly sends "photo_url": null, we want to clear the profile picture
    # If frontend does not send "photo_url" key in payload, we don't want to clear the profile picture

    # Convert payload to a dictionary containing only the keys explicitly sent by the frontend
    sent_data = user_details.model_dump(exclude_unset=True)
    if "photo_url" in sent_data:
        # There is a photo_url key and user_details.photo_url is not null
        if user_details.photo_url:
            new_photo = Photo(url=user_details.photo_url.strip())
            db.add(new_photo)
            db.flush()
            current_user.photo_id = new_photo.id
        else:
            # user_details.photo_url is null
            current_user.photo_id = None

    db.commit()

    profile = (
        db.query(UserProfileView)
        .filter(UserProfileView.user_id == current_user.id)
        .first()
    )
    return profile


@router.patch(
    "/me/change-password",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def change_user_password(
    user_password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a user password
    """
    user_current_password = user_password_data.current_password
    user_new_password = user_password_data.new_password

    # Check current password
    if not verify_password(user_current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password.",
        )

    # Prevent reusing the same identical password
    if verify_password(user_new_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be identical to your current password.",
        )

    # Hash and store new password
    current_user.password = get_password_hash(user_new_password)
    db.commit()

    return {"message": "Password updated successfully."}
