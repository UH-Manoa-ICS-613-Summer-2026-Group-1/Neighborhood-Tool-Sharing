import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.tool import DEFAULT_LOAN_DURATION_LIMIT, ToolCondition
from app.schemas.photo import PhotoSchema

from .common import CleanStr

# REQUEST SCHEMAS


class ToolRequest(BaseModel):
    tool_type_code: str = Field(
        ...,
        description="Tool category code (e.g., POWER_TOOLS).",
        examples=["POWER_TOOLS"],
    )
    title: CleanStr = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Title must be between 3 and 255 characters long.",
    )
    description: CleanStr = Field(
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
    pickup_notes: CleanStr | None = Field(default=None, max_length=2000)
    return_notes: CleanStr | None = Field(default=None, max_length=2000)
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


class ToolResponse(BaseModel):
    id: uuid.UUID
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


class ToolDetailsResponse(BaseModel):
    """
    Tools response schema matching only the necessary fields from the tools_v view.
    """

    tool_id: uuid.UUID
    owner_id: uuid.UUID
    owner_first_name: str
    owner_last_name: str
    owner_middle_name: str | None
    tool_type_id: int
    tool_type_code: str
    tool_type_name: str
    tool_title: str
    tool_description: str
    tool_condition: str
    tool_pickup_notes: str | None
    tool_return_notes: str | None
    tool_loan_duration_limit: int
    tool_status: str
    tool_created_at: datetime
    tool_photos: list[PhotoSchema]

    model_config = ConfigDict(from_attributes=True)
