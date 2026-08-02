import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.report import ReportCategory, ReportStatus, ReportTargetType

from .common import CleanStr

# REQUEST SCHEMAS


class ReportCreateRequest(BaseModel):
    target_id: uuid.UUID = Field(
        ...,
        description="The unique identifier of the target of the report. For example, uuid of a reservation, tool, or another user.",
    )
    target_type: ReportTargetType = Field(
        ...,
        description="The type of the target of the report. For example, RESERVATION, TOOL, or USER.",
    )
    category: ReportCategory = Field(
        ...,
        description="The category of the report. For example, LATE_RETURN, TOOL_DAMAGED, INAPPROPRIATE_BEHAVIOR, OTHER, and etc.",
    )
    description: CleanStr = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Report description must be between 5 and 2000 characters long.",
    )


# RESPONSE SCHEMAS


class ReportResponse(BaseModel):
    id: uuid.UUID
    reporter_id: uuid.UUID
    target_id: uuid.UUID
    target_type: ReportTargetType
    category: ReportCategory
    description: str
    status: ReportStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
