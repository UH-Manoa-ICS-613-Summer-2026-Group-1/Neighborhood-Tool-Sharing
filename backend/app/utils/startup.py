"""
Startup fastapi functions
"""

import json
from contextlib import asynccontextmanager

from botocore.exceptions import ClientError
from fastapi import FastAPI

from app.utils.storage import BUCKET_NAME, generate_dummy_image, internal_s3


# Create a bucket for images storage if it doesn't exist
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        internal_s3.head_bucket(Bucket=BUCKET_NAME)
        print(f"Storage bucket '{BUCKET_NAME}' verified.")
    except ClientError:
        print(f"Bucket '{BUCKET_NAME}' not found. Initializing now...")
        internal_s3.create_bucket(Bucket=BUCKET_NAME)

        # Define a read-only policy so the public can view uploaded tool pictures
        public_read_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"],
                }
            ],
        }

        # Apply the policy
        internal_s3.put_bucket_policy(
            Bucket=BUCKET_NAME, Policy=json.dumps(public_read_policy)
        )
        print(
            f"Storage bucket '{BUCKET_NAME}' successfully setup with public read access."
        )

    generate_dummy_image()
    yield
