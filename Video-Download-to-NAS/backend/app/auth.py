from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os

from .database import User, APIToken, get_db

SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def authenticate_user(db: Session, username: str, password: str):
    """
    Authenticate user with username and password.
    Works for all users regardless of auth_provider (local, SSO, etc.)
    SSO users can still use local authentication if they have set a password.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return False
    
    # Verify password - works for both local and SSO users
    # SSO users may have a password set for local authentication fallback
    if not verify_password(password, user.hashed_password):
        return False
    
    # Check if user account is active (승인 대기 체크)
    if user.is_active == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending admin approval"
        )
    
    return user


def authenticate_with_token(db: Session, token: str) -> Optional[User]:
    """
    Authenticate user with API token
    
    Args:
        db: Database session
        token: Plain text API token (e.g., "vdtn_abc123...")
        
    Returns:
        User object if token is valid, None otherwise
    """
    from .token_utils import verify_token_hash
    
    # Validate token format
    if not token or not token.startswith('vdtn_'):
        return None
    
    # Query all active tokens
    # Note: We need to check each token hash with bcrypt
    # This is not ideal for performance, but necessary with bcrypt
    active_tokens = db.query(APIToken).filter(
        APIToken.is_active == 1
    ).all()
    
    # Check each token hash
    for db_token in active_tokens:
        if verify_token_hash(token, db_token.token_hash):
            # Update last_used_at timestamp
            db_token.last_used_at = datetime.now()
            db.commit()
            
            # Return user
            return db_token.user
    
    return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def init_default_user(db: Session):
    """Check if any users exist, log status"""
    user_count = db.query(User).count()
    
    if user_count == 0:
        print("ℹ️  No users found. Please register the first user to become super_admin.")
    else:
        print(f"✅ {user_count} user(s) found in database.")

def require_role(required_roles: list):
    """Dependency to check if user has required role"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker
