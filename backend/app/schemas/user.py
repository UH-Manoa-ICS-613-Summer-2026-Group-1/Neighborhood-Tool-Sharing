from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

# RESPONSE SCHEMAS


class UserProfileResponse(BaseModel):
    """
    User profile response schema matching only the necessary fields from the user_profiles_v view.
    """

    user_name: str
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
