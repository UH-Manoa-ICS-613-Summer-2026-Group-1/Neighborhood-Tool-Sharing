"""
Startup fastapi functions
"""

import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import requests
from apscheduler.schedulers.background import (  # type: ignore[import-untyped]
    BackgroundScheduler,
)
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    EndpointConnectionError,
)
from fastapi import FastAPI
from sqlalchemy import text

from app.database import SessionLocal
from app.schemas.reservation import APP_TIMEZONE, APP_TIMEZONE_NAME
from app.utils.notification_helpers import run_daily_reservation_reminders
from app.utils.storage import (
    BUCKET_NAME,
    EXTERNAL_ENDPOINT,
    generate_dummy_image,
    internal_s3,
)

# Initialize global scheduler instance
scheduler = BackgroundScheduler()


def execute_daily_reminders():
    """
    Background task to execute daily reminders
    """
    db = SessionLocal()
    try:
        run_daily_reservation_reminders(db)
    except Exception as e:
        print(f"Error executing daily reservation reminders: {str(e)}")
    finally:
        db.close()


def ping_storage_service():
    """
    Send a plain HTTP request to wake up storage if it's sleeping on Render free tier.
    """
    print(f"Pinging storage endpoint ({EXTERNAL_ENDPOINT}) to wake service...")
    # Check that the required EXTERNAL_ENDPOINT variable is defined
    if EXTERNAL_ENDPOINT is None or EXTERNAL_ENDPOINT.strip() == "":
        raise RuntimeError(f"Missing required environment variable {EXTERNAL_ENDPOINT}")

    # Timeout set to 30s so Render has time to spin up the container during cold start
    response = requests.get(EXTERNAL_ENDPOINT, timeout=30)
    print(f"Storage service ping responded with status: {response.status_code}")


def init_storage_bucket():
    """
    Create a bucket for images storage if it doesn't exist
    """
    # check if the required BUCKET_NAME variable is undefined or blank
    if BUCKET_NAME is None or BUCKET_NAME.strip() == "":
        raise RuntimeError(f"Missing required environment variable {BUCKET_NAME}")

    try:
        internal_s3.head_bucket(Bucket=BUCKET_NAME)
        print(f"Storage bucket '{BUCKET_NAME}' verified.")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        # 404 or NoSuchBucket means the bucket doesn't exist yet
        if error_code in ("404", "NoSuchBucket"):
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
        else:
            raise RuntimeError(f"Storage error: {str(e)}")


def init_storage(max_retries=10, delay=5):
    """
    Wait for storage to be ready.
    """
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Connecting to storage (Attempt {attempt}/{max_retries})...")
            # Try to ping the storage service
            ping_storage_service()
            # Try to create the bucket
            init_storage_bucket()
            print("Successfully connected to storage.")
            return
        except (BotoCoreError, EndpointConnectionError, Exception) as e:
            print(f"Storage not ready yet ({str(e)}). Retrying in {delay}s...")
            time.sleep(delay)

    raise RuntimeError("Could not connect to storage after maximum retries.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Wait storage to be ready, create bucket
    init_storage()

    # Generate placeholder image
    generate_dummy_image()

    # Run daily reminders every 24 hours
    scheduler.add_job(
        execute_daily_reminders,
        trigger="cron",
        hour=10,
        minute=0,
        timezone=APP_TIMEZONE_NAME,
        next_run_time=datetime.now(timezone.utc).astimezone(APP_TIMEZONE),
    )
    scheduler.start()
    print("Background scheduler started.")

    yield

    scheduler.shutdown()
    print("Background scheduler stopped.")
