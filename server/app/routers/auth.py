import os
import jwt

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth_helpers import get_password_hash, verify_password, create_access_token, get_current_user
from app.schemas.auth import UserRegisterSchema, UserLoginSchema, TokenResponse
from app.blocklist import TOKEN_BLOCKLIST

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"

USER_DB = {}

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

security_scheme = HTTPBearer()

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
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM], 
            options={"verify_exp": False} # do not check if the token is expired
        )

        jti = payload.get("jti")
        
        # Add it to the blocklist so it cannot be used again
        TOKEN_BLOCKLIST.add(jti)
        return {"message": "Successfully logged out."}
        
    except jwt.PyJWTError:
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, 
        detail="Invalid token provided for logout.")
        
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