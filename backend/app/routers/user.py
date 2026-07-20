"""
User profile routers.
Handles getting and updating user profiles, changing password.
"""

import uuid

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
    CurrentUserProfileResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from app.utils.auth_helpers import (
    get_password_hash,
    verify_password,
)
from app.utils.dependencies import get_current_user, validate_urls_ownership
from app.utils.storage import BUCKET_NAME, internal_s3

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get(
    "/me",
    response_model=CurrentUserProfileResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Retrieve a current user profile.
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
    response_model=CurrentUserProfileResponse,
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
    # Handle first and last name
    if user_details.first_name is not None:
        current_user.first_name = user_details.first_name
    if user_details.last_name is not None:
        current_user.last_name = user_details.last_name

    # Handle middle name, bio, and location
    # If the user sent an empty string, save it as None
    if user_details.middle_name is not None:
        current_user.middle_name = (
            user_details.middle_name if user_details.middle_name != "" else None
        )
    if user_details.bio is not None:
        current_user.bio = user_details.bio if user_details.bio != "" else None
    if user_details.location is not None:
        current_user.location = (
            user_details.location if user_details.location != "" else None
        )

    # Handle photo url
    # If frontend explicitly sends "photo_url": null, we want to clear the profile picture
    # If frontend does not send "photo_url" key in payload, we don't want to clear the profile picture

    # Convert payload to a dictionary containing only the keys explicitly sent by the frontend
    sent_data = user_details.model_dump(exclude_unset=True)

    # For orphan photo deletion from storage
    url_to_delete_from_storage = None

    if "photo_url" in sent_data:
        # Fetch the user's current photo if one exists
        old_photo = None
        if current_user.photo_id:
            old_photo = (
                db.query(Photo).filter(Photo.id == current_user.photo_id).first()
            )

        # Check that the currecnt user does not use someone else's photo from storage
        if user_details.photo_url:
            validate_urls_ownership(current_user, [user_details.photo_url])
            # Map the new photo
            new_photo = Photo(url=user_details.photo_url)
            db.add(new_photo)
            db.flush()
            current_user.photo_id = new_photo.id
        else:
            # user_details.photo_url is null
            current_user.photo_id = None

        db.flush()
        if old_photo:
            # For orphan photo deletion from storage
            url_to_delete_from_storage = (
                old_photo.url if old_photo.url != user_details.photo_url else None
            )

            # Delete the old photo
            db.query(Photo).filter(Photo.id == old_photo.id).delete(
                synchronize_session=False
            )

    try:
        db.commit()

        # Delete the orphan records from storage
        if url_to_delete_from_storage:
            try:
                # Get the object name
                object_name = (
                    f"{current_user.id}/{url_to_delete_from_storage.split('/')[-1]}"
                )

                # Remove the object
                internal_s3.delete_object(Bucket=BUCKET_NAME, Key=object_name)
                print(f"Successfully deleted orphan asset {object_name} from storage.")
            except Exception as e:
                print(
                    f"Failed to remove asset {url_to_delete_from_storage} from storage: {str(e)}"
                )

        profile = (
            db.query(UserProfileView)
            .filter(UserProfileView.user_id == current_user.id)
            .first()
        )
        return profile

    except Exception as e:
        db.rollback()
        print(f"Database write failure during user PATCH pipeline: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile.",
        )


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


@router.get(
    "/{user_id}",
    response_model=UserProfileResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        404: {"model": DetailError},
    },
)
def get_user_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve a user profile.
    """
    profile = (
        db.query(UserProfileView).filter(UserProfileView.user_id == user_id).first()
    )

    # Not found or not active
    if not profile or bool(profile.status_code != "ACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found or is currently unavailable.",
        )

    return profile
