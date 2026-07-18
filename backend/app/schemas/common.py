from typing import Annotated
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, BeforeValidator

from app.utils.auth_helpers import strip_spaces
from app.utils.storage import BUCKET_NAME, EXTERNAL_ENDPOINT

# Create a custom validator for the media URL
# We will allows media URLs from our local MinIO or production AWS S3 buckets
# Extract domain blocks
LOCAL_DEV_MEDIA_DOMAIN = urlparse(EXTERNAL_ENDPOINT).netloc  # localhost:9000
AWS_S3_DOMAIN = f"{BUCKET_NAME}.s3.amazonaws.com"  # If we use AWS S3

ALLOWED_DOMAINS = {LOCAL_DEV_MEDIA_DOMAIN, AWS_S3_DOMAIN}


def validate_trusted_media_url(value: str | None) -> str | None:
    """
    Reusable validator to ensure photo URLs originate only from
    our trusted local MinIO or production AWS S3 buckets.
    """
    if value is None:
        return value

    parsed_url = urlparse(value.strip())

    if parsed_url.netloc not in ALLOWED_DOMAINS:
        raise ValueError("Untrusted image source domain.")

    return value


def validate_trusted_media_urls_list(values: list[str]) -> list[str]:
    """
    Reusable list validator. Loops through every URL in a list
    and applies our single URL validator.
    """
    for val in values:
        validate_trusted_media_url(val)
    return values


# Define a custom type
# We want that pydantic catchs the min length when the field consist of only spaces
# This prevent a bug when a user registers with a spaces in their first and last names
CleanStr = Annotated[str, BeforeValidator(strip_spaces)]

# Define a custom type for user photo URL
TrustedMediaUrl = Annotated[str, AfterValidator(validate_trusted_media_url)]

# Define a custom type for list of tool photo URLs
TrustedMediaUrlsList = Annotated[
    list[str], AfterValidator(validate_trusted_media_urls_list)
]

# RESPONSE SCHEMAS


class MessageResponse(BaseModel):
    message: str


# ERROR SCHEMAS


class DetailError(BaseModel):
    detail: str
