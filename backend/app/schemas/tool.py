import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.tool import DEFAULT_LOAN_DURATION_LIMIT, ToolCondition, ToolStatus
from app.schemas.photo import PhotoSchema
from app.utils.storage import DUMMY_IMAGE_URL

from .common import CleanStr, TrustedMediaUrlsList

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
    photo_urls: TrustedMediaUrlsList = Field(
        ...,
        min_length=1,
        max_length=5,
        description="A tool must have 1 to 5 photos.",
        examples=[[DUMMY_IMAGE_URL]],
    )
    pickup_notes: CleanStr | None = Field(default=None, max_length=2000)
    return_notes: CleanStr | None = Field(default=None, max_length=2000)
    loan_duration_limit: int = Field(
        DEFAULT_LOAN_DURATION_LIMIT,
        ge=1,
        le=365,
        description="Loan limit in days (1 to 365 days).",
    )


class ToolUpdateRequest(BaseModel):
    tool_type_code: str | None = Field(
        default=None, description="Tool category code (e.g., POWER_TOOLS)."
    )
    title: CleanStr | None = Field(default=None, min_length=3, max_length=255)
    description: CleanStr | None = Field(default=None, min_length=5, max_length=2000)
    condition: ToolCondition | None = Field(default=None)
    photo_urls: TrustedMediaUrlsList | None = Field(
        default=None,
        min_length=1,
        max_length=5,
        description="Updated list of 1 to 5 photo URLs.",
        examples=[[DUMMY_IMAGE_URL]],
    )
    pickup_notes: CleanStr | None = Field(default=None, max_length=2000)
    return_notes: CleanStr | None = Field(default=None, max_length=2000)
    loan_duration_limit: int | None = Field(default=None, ge=1, le=365)
    # The owner of the tool can only set the status to "AVAILABLE" or "HIDDEN".
    # The status deleted handled separately.
    status: ToolStatus | None = Field(
        default=None, description="Set to 'AVAILABLE' or 'HIDDEN'."
    )

    @field_validator("status")
    @classmethod
    def ensure_tool_status_is_valid(cls, value: ToolStatus) -> ToolStatus:
        """
        The status field can only be set to "AVAILABLE" or "HIDDEN".
        """
        if value not in [ToolStatus.AVAILABLE, ToolStatus.HIDDEN]:
            raise ValueError("status must be 'AVAILABLE' or 'HIDDEN'")
        return value


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
