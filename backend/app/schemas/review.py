import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from .common import CleanStr

# REQUEST SCHEMAS


class ReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating must be between 1 and 5.")
    comment: CleanStr | None = Field(None, description="Optional textual feedback.")


# RESPONSE SCHEMAS


class ReviewResponse(BaseModel):
    id: uuid.UUID
    reservation_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewee_id: uuid.UUID
    rating: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewDetailsResponse(BaseModel):
    review_id: uuid.UUID
    reservation_id: uuid.UUID

    reviewee_id: uuid.UUID
    reviewee_first_name: str
    reviewee_last_name: str
    reviewee_middle_name: str | None
    reviewee_photo_url: str | None

    reviewer_id: uuid.UUID
    reviewer_first_name: str
    reviewer_last_name: str
    reviewer_middle_name: str | None
    reviewer_photo_url: str | None

    rating: int
    comment: str | None
    created_at: datetime
