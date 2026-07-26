"""
Startup fastapi functions
"""

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.background import (  # type: ignore[import-untyped]
    BackgroundScheduler,
)
from botocore.exceptions import ClientError
from fastapi import FastAPI

from app.database import SessionLocal
from app.schemas.reservation import APP_TIMEZONE, APP_TIMEZONE_NAME
from app.utils.notification_helpers import run_daily_reservation_reminders
from app.utils.storage import BUCKET_NAME, generate_dummy_image, internal_s3

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


# Create a bucket for images storage if it doesn't exist
@asynccontextmanager
async def lifespan(app: FastAPI):
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
            print(f"Storage error: {e}")

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
