import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from .common import CleanStr


class ReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating must be between 1 and 5.")
    comment: CleanStr | None = Field(None, description="Optional textual feedback.")


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
