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
