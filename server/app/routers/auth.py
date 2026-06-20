import os
import jwt
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.database import get_db
from app.models.user import User

from app.utils.auth_helpers import get_password_hash, verify_password, create_access_token
from app.utils.dependencies import get_current_user
from app.blocklist import TOKEN_BLOCKLIST

from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    MessageResponse,
    ProtectedProfileResponse,
    DetailError
)

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

security_scheme = HTTPBearer()

@router.post("/register",
             status_code=status.HTTP_201_CREATED,
             response_model=MessageResponse,
             responses={400: {"model": DetailError}})
def register(user_data: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if user already exists in the database
    user = db.query(User).filter(User.email == user_data.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered."
        )
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password=hashed_password,
        name=user_data.email.split("@")[0], # Temporary name
        status_id=1,                        # 'Active' 
        role_id=1                           # 'User'
    )
    
    db.add(new_user)
    db.commit()
    
    return {"message": "User registered successfully."}

@router.post("/login", 
             response_model=TokenResponse,
             responses={401: {"model": DetailError}})
def login(credentials: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    
    # Generate JWT containing the user's email address as the "sub"
    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/logout", 
             response_model=MessageResponse,
             responses={401: {"model": DetailError}})
def logout(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM], 
            options={"verify_exp": False} # Do not check if the token is expired
        )

        jti = payload.get("jti")
        TOKEN_BLOCKLIST.add(jti)
        return {"message": "Successfully logged out."}
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid token provided for logout."
        )

# A test route
@router.get("/protected-profile", 
            response_model=ProtectedProfileResponse,
            responses={401: {"model": DetailError}})
def get_profile(current_user: User = Depends(get_current_user)):
    """
    This route is locked! Only users passing a valid JWT can see it.
    """
    return {
        "message": "Access granted! You are inside a locked route.",
        "user_details": current_user
    }