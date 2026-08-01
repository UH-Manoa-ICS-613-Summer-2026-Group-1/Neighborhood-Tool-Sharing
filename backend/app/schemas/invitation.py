import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.utils.auth_helpers import normalize_email

# REQUEST SCHEMAS


class InvitationCreateRequest(BaseModel):
    recipient_email: EmailStr

    @field_validator("recipient_email", mode="before")
    @classmethod
    def lowercase_recipient_email(cls, value: str) -> str:
        return normalize_email(value)


# RESPONSE SCHEMAS


class InvitationValidateResponse(BaseModel):
    recipient_email: EmailStr


class InvitationResponse(BaseModel):
    """
    User invitation response schema matching only the necessary fields from the invitation_history_v view.
    """

    recipient_email: EmailStr
    status: str

    model_config = ConfigDict(from_attributes=True)


class InvitationDetailsResponse(BaseModel):
    invitation_id: uuid.UUID
    sender_id: uuid.UUID
    recipient_email: str
    status: str
    recipient_id: uuid.UUID | None
    created_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)
