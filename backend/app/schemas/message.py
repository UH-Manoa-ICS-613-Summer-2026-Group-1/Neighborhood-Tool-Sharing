from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .common import CleanStr

# REQUEST SCHEMAS


class MessageCreate(BaseModel):
    content: CleanStr = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Message content must be between 1 and 2000 characters long.",
    )


# RESPONSE SCHEMAS


class MessageResponse(BaseModel):
    id: UUID
    reservation_id: UUID
    sender_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
