import re

from pydantic import BaseModel, EmailStr, Field, field_validator

# REQUEST SCHEMAS


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        ...,
        min_length=8,
        max_length=64,
        description="Password must be between 8 and 64 characters long.",
        examples=["Mysecurepassword1!"],
    )

    @field_validator("password")
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


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, examples=["Mysecurepassword1!"])


# RESPONSE SCHEMAS


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
