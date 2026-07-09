import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.tool import DEFAULT_LOAN_DURATION_LIMIT, ToolCondition

# REQUEST SCHEMAS


class ToolRequest(BaseModel):
    tool_type_id: int = Field(
        ...,
        description="Tool category ID (1, 2, 3, etc.).",
        examples=[1],
    )
    title: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Title must be between 3 and 255 characters long.",
    )
    description: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Description must be between 5 and 2000 characters long.",
    )
    condition: ToolCondition
    photo_urls: list[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="A tool must have 1 to 5 photos.",
    )
    pickup_notes: str | None = Field(default=None, max_length=2000)
    return_notes: str | None = Field(default=None, max_length=2000)
    loan_duration_limit: int = Field(
        DEFAULT_LOAN_DURATION_LIMIT,
        ge=1,
        le=365,
        description="Loan limit in days (1 to 365 days).",
    )


# RESPONSE SCHEMAS
class ToolTypeResponse(BaseModel):
    id: int
    code: str
    display_name: str
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class PhotoSchema(BaseModel):
    id: uuid.UUID
    url: str

    model_config = ConfigDict(from_attributes=True)


class ToolResponse(BaseModel):
    tool_type_id: int
    title: str
    description: str
    condition: ToolCondition
    photos: list[PhotoSchema]
    pickup_notes: str | None
    return_notes: str | None
    loan_duration_limit: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
