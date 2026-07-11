"""
Storage utilities
"""

import os
from typing import Any

import boto3
from botocore.config import Config

# Gather configuration from  Docker environment variables
ACCESS_KEY = os.getenv("STORAGE_ACCESS_KEY")
SECRET_KEY = os.getenv("STORAGE_SECRET_KEY")
BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME")
INTERNAL_ENDPOINT = os.getenv("STORAGE_INTERNAL_ENDPOINT")
EXTERNAL_ENDPOINT = os.getenv("STORAGE_EXTERNAL_ENDPOINT")

MAX_SIZE_MB = 5  # The max size of the image that can be uploaded in MB

# Force MinIO to use path-style addressing (e.g., endpoint/bucket instead of bucket.endpoint)
s3_config = Config(s3={"addressing_style": "path"}, signature_version="s3v4")

# Internal client (For backend network operations)
internal_s3 = boto3.client(
    "s3",
    endpoint_url=INTERNAL_ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=s3_config,
)

# External client (For creating browser upload tickets)
external_s3 = boto3.client(
    "s3",
    endpoint_url=EXTERNAL_ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=s3_config,
)


def generate_upload_ticket(
    object_name: str, expiration: int = 300, max_size_mb: int = MAX_SIZE_MB
) -> dict[str, Any]:
    """
    Generates a temporary, signed PUT URL that a frontend browser
    can target directly to upload an image.
    """
    max_bytes = max_size_mb * 1024 * 1024  # Convert MB to Bytes

    return external_s3.generate_presigned_post(
        Bucket=BUCKET_NAME,
        Key=object_name,
        Fields={"Content-Type": "image/"},  # Tells the browser what to expect
        Conditions=[
            ["starts-with", "$Content-Type", "image/"],  # Enforces image mime type
            [
                "content-length-range",
                1,
                max_bytes,
            ],  # Enforces size: Min 1 byte, Max 5MB
        ],
        ExpiresIn=expiration,  # Ticket expires in 5 minutes
    )
