import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# REQUEST SCHEMAS


class UserProfileUpdateRequest(BaseModel):
    first_name: str | None = Field(
        None, min_length=1, max_length=255, description="User's first name"
    )
    last_name: str | None = Field(
        None, min_length=1, max_length=255, description="User's last name"
    )
    middle_name: str | None = Field(
        None, min_length=1, max_length=255, description="User's middle name"
    )
    bio: str | None = Field(None, max_length=2000, description="User's bio")
    location: str | None = Field(None, max_length=255, description="User's location")
    photo_url: str | None = Field(
        None, description="Permanent URL returned from /api/media/upload"
    )


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=64,
        description="Password must be between 8 and 64 characters long.",
        examples=["ValidPassword1!"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", value):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_+=-]", value):
            raise ValueError("Password must contain at least one special character.")
        return value


# RESPONSE SCHEMAS


class UserProfileResponse(BaseModel):
    """
    User profile response schema matching only the necessary fields from the user_profiles_v view.
    """

    user_id: uuid.UUID
    user_first_name: str
    user_last_name: str
    user_middle_name: str | None = None
    user_email: EmailStr
    user_bio: str | None = None
    user_location: str | None = None
    user_created_at: datetime
    user_photo_url: str | None = None
    role_code: str
    role_name: str
    role_description: str | None = None
    status_code: str
    status_name: str
    status_description: str | None = None

    model_config = ConfigDict(from_attributes=True)
