from pydantic import BaseModel, ConfigDict, EmailStr

# REQUEST SCHEMAS


class InvitationCreateRequest(BaseModel):
    recipient_email: EmailStr


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
