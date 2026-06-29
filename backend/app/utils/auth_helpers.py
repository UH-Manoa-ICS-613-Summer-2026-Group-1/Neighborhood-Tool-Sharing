"""
Authentication helpers.
"""

import base64
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"


def get_password_hash(password: str) -> str:
    """
    Hashes the password.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(
        base64.b64encode(hashlib.sha256(password_bytes).digest()), salt
    )

    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies the password against the stored database hashed password.
    """
    password_bytes = password.encode("utf-8")
    password_b64 = base64.b64encode(hashlib.sha256(password_bytes).digest())

    hashed_bytes = hashed_password.encode("utf-8")

    return bcrypt.checkpw(password_b64, hashed_bytes)


def create_access_token(data: dict[str, Any]) -> str:
    """
    Generates JWT.

    JWT contains {sub: user_id, exp: expiration_time, jti: uuid}.

    JTI is JWT identifier that will be added to the blocklist when the user logs out.
    """
    to_encode = data.copy()
    # Set expiration time (current time + 60 minutes)
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    # Add jti for blocklist functionality
    to_encode["jti"] = str(uuid.uuid4())

    # Encode the token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
