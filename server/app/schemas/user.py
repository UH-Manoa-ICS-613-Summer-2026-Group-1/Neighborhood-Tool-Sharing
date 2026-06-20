import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr

# RESPONSE SCHEMAS

class PhotoResponse(BaseModel):
    id: uuid.UUID
    url: str

    class Config:
        from_attributes = True

class RoleStatusResponse(BaseModel):
    code: str
    display_name: str

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True