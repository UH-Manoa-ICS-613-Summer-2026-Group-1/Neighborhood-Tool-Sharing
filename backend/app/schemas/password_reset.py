import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.auth_helpers import normalize_email


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return normalize_email(value)


class ResetPasswordSubmitRequest(BaseModel):
    reset_token: str
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
