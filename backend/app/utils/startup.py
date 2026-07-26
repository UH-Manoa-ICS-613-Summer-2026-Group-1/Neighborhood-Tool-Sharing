"""
Startup fastapi functions
"""

import json
import os
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
from dotenv import load_dotenv
from fastapi import FastAPI

from app.database import SessionLocal
from app.schemas.reservation import APP_TIMEZONE, APP_TIMEZONE_NAME
from app.utils.notification_helpers import run_daily_reservation_reminders
from app.utils.storage import (
    BUCKET_NAME,
    EXTERNAL_ENDPOINT,
    generate_dummy_image,
    internal_s3,
)

load_dotenv()

# On render.com there is production environment variable
PRODUCTION = os.getenv("PRODUCTION", "false").lower()
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


def ping_storage_service(max_ping_attempts=3, delay=15):
    """
    Send a plain HTTP request to wake up storage if it's sleeping on Render free tier.
    """
    print(f"Pinging storage endpoint ({EXTERNAL_ENDPOINT}) to wake service...")
    # Check that the required EXTERNAL_ENDPOINT variable is defined
    if EXTERNAL_ENDPOINT is None or EXTERNAL_ENDPOINT.strip() == "":
        raise RuntimeError("Missing required environment variable EXTERNAL_ENDPOINT")

    health_url = f"{EXTERNAL_ENDPOINT}/minio/health/live"

    # Browser headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    for attempt in range(1, max_ping_attempts + 1):
        print(
            f"Pinging storage endpoint ({health_url}) [Attempt {attempt}/{max_ping_attempts}]..."
        )
        try:
            response = requests.get(health_url, headers=headers, timeout=45)
            print(f"Storage service ping responded with status: {response.status_code}")

            # If the response is 200, the service is awake and healthy
            if response.status_code == 200:
                print("The storage service is fully awake and healthy!")
                return
            elif response.status_code == 429:
                print("Render edge returned 429 rate limit. Waiting to retry...")
            else:
                print(
                    f"Service responded with {response.status_code}, waiting for ready state..."
                )
        except Exception as e:
            print(f"Service still booting up ({str(e)})...")

        time.sleep(delay)

    raise RuntimeError("Storage service failed to respond within the timeout limit.")


def init_storage_bucket():
    """
    Create a bucket for images storage if it doesn't exist
    """
    # check if the required BUCKET_NAME variable is undefined or blank
    if BUCKET_NAME is None or BUCKET_NAME.strip() == "":
        raise RuntimeError("Missing required environment variable BUCKET_NAME")

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


def init_storage():
    """
    Wait for storage to be ready and create the bucket.
    """

    # On production
    if PRODUCTION == "true":
        # Try to ping the storage service
        ping_storage_service()
        time.sleep(3)

    # Try to create the bucket
    try:
        init_storage_bucket()
    except (BotoCoreError, EndpointConnectionError, Exception) as e:
        raise RuntimeError(f"Could not connect to storage. Error: {str(e)}")


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
