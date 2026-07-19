"""
Media routers.
Handles uploading media files.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.common import DetailError
from app.schemas.media import MediaResponse, MediaUploadRequest
from app.utils.dependencies import get_current_user
from app.utils.storage import BUCKET_NAME, EXTERNAL_ENDPOINT, generate_upload_ticket

router = APIRouter(prefix="/api/media", tags=["Media"])


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    response_model=MediaResponse,
    responses={
        401: {"model": DetailError},
        403: {"model": DetailError},
        400: {"model": DetailError},
    },
)
def upload_media(file_data: MediaUploadRequest, current_user=Depends(get_current_user)):
    """
    Create a temporary upload ticket and permanent url.
    """
    # Verify file extension safety
    file_ext = file_data.filename.split(".")[-1].lower()
    if file_ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Supported: jpg, jpeg, png, webp.",
        )

    # Generate a unique file path name
    unique_storage_key = f"{current_user.id}/{uuid.uuid4()}.{file_ext}"

    # Generates a dictionary containing {'url': '...', 'fields': {...}}
    ticket = generate_upload_ticket(unique_storage_key)

    # Construct the link the frontend will send to the backend if the upload is successful
    permanent_url = f"{EXTERNAL_ENDPOINT}/{BUCKET_NAME}/{unique_storage_key}"

    return {
        # The core MinIO endpoint URL
        "upload_target": ticket["url"],
        # The required crypto & size verification data rules
        "upload_fields": ticket["fields"],
        # The permanent url
        "url": permanent_url,
    }
