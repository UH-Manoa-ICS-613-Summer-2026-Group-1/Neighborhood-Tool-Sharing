import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

# RESPONSE SCHEMAS

class PhotoResponse(BaseModel):
    id: uuid.UUID
    url: str

    model_config = ConfigDict(from_attributes=True)

class RoleStatusResponse(BaseModel):
    code: str
    display_name: str
    description: str | None = None
    
    model_config = ConfigDict(from_attributes=True)

class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    bio: str | None = None
    location: str | None = None
    created_at: datetime
    photo: PhotoResponse | None = None    
    role: RoleStatusResponse
    status: RoleStatusResponse

    model_config = ConfigDict(from_attributes=True)