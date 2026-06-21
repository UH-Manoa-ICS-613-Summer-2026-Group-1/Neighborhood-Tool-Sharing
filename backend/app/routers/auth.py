import uuid
import jwt
import bcrypt
import os

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

from app.schemas import UserRegisterSchema, UserLoginSchema, TokenResponse
from app.database import USER_DB

load_dotenv()

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-testing-key-123456789")
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"

security_scheme = HTTPBearer()

# This variable contains the blocklist of the JWT tokens. So tokens can be added to the blocklist when the user logs out
TOKEN_BLOCKLIST = set()

def get_password_hash(password: str) -> str:
    """
    Hashes the password
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """
    A reusable dependency function. Protects routes by forcing incoming 
    requests to submit a valid, unexpired JWT.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Check if JTI token has been blocklisted on logout
        jti = payload.get("jti")
        if jti in TOKEN_BLOCKLIST:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Token has been revoked (logged out)."
            )

        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token payload"
            )
        return {"email": email}
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token has expired. Please log in again."
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Could not validate credentials"
        )

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegisterSchema):
    if user_data.email in USER_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    # password_validation() can be added here
    
    hashed_password = get_password_hash(user_data.password)
    USER_DB[user_data.email] = {
        "email": user_data.email,
        "hashed_password": hashed_password
    }
    return {"message": "User registered successfully!"}


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLoginSchema):
    user = USER_DB.get(credentials.email)
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Generate JWT containing the user's email address as the "subject" (sub)
    token = create_access_token(data={"sub": user["email"]})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = credentials.credentials
    try:
        # Decode the token to jti
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        
        # Add it to the blocklist so it cannot be used again
        TOKEN_BLOCKLIST.add(jti)
        return {"message": "Successfully logged out."}
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid token provided for logout."
        )

# A test route
@router.get("/protected-profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    """
    This route is locked! Only users passing a valid JWT can see it.
    """
    return {
        "message": "Access granted! You are inside a locked route.",
        "user_details": current_user
    }