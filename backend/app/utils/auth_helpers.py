import os
import uuid
import bcrypt
import jwt

from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

load_dotenv()

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"

def get_password_hash(password: str) -> str:
    """
    Hashes the password.
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    bcrypt.hashpw()
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies the password against the stored database hashed password.
    """
    password_bytes = password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

def create_access_token(data: dict) -> str:
    """
    Generates JWT.
    """
    to_encode = data.copy()
    # Set expiration time (current time + 60 minutes)
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # generate jti for blocklist functionality
    to_encode["jti"] = str(uuid.uuid4())
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt