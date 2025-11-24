"""
SSO Security Utilities

This module provides security utilities for SSO authentication including:
- Client secret encryption/decryption
- State parameter generation and verification
- Expired state cleanup
"""

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

# Load encryption key from environment
SSO_ENCRYPTION_KEY = os.getenv("SSO_ENCRYPTION_KEY")

if not SSO_ENCRYPTION_KEY:
    logger.warning("SSO_ENCRYPTION_KEY not set in environment. SSO features will not work properly.")
    _cipher = None
else:
    try:
        _cipher = Fernet(SSO_ENCRYPTION_KEY.encode())
    except Exception as e:
        logger.error(f"Failed to initialize Fernet cipher: {e}")
        _cipher = None


def encrypt_client_secret(secret: str) -> str:
    """
    Encrypt a client secret using Fernet symmetric encryption.
    
    Args:
        secret: The plaintext client secret to encrypt
        
    Returns:
        The encrypted secret as a string
        
    Raises:
        HTTPException: If encryption key is not configured
    """
    if not _cipher:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SSO encryption is not configured. Please set SSO_ENCRYPTION_KEY environment variable."
        )
    
    try:
        encrypted = _cipher.encrypt(secret.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"Failed to encrypt client secret: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to encrypt client secret"
        )


def decrypt_client_secret(encrypted_secret: str) -> str:
    """
    Decrypt a client secret using Fernet symmetric encryption.
    
    Args:
        encrypted_secret: The encrypted client secret
        
    Returns:
        The decrypted plaintext secret
        
    Raises:
        HTTPException: If encryption key is not configured or decryption fails
    """
    if not _cipher:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SSO encryption is not configured. Please set SSO_ENCRYPTION_KEY environment variable."
        )
    
    try:
        decrypted = _cipher.decrypt(encrypted_secret.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Failed to decrypt client secret: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt client secret. The encryption key may have changed."
        )


def generate_state(db: Session, provider: str, user_id: Optional[int] = None) -> str:
    """
    Generate a cryptographically secure random state parameter for OAuth2 flow.
    
    The state parameter is used to prevent CSRF attacks by ensuring that the
    callback request comes from the same session that initiated the OAuth2 flow.
    
    Args:
        db: Database session
        provider: OAuth2 provider name (e.g., 'google', 'microsoft', 'github')
        user_id: Optional user ID for account linking flows
        
    Returns:
        A cryptographically random state string
        
    Raises:
        HTTPException: If database operation fails
    """
    from app.database import SSOState
    
    # Generate cryptographically secure random state (32 bytes = 43 characters in base64)
    state = secrets.token_urlsafe(32)
    
    # State expires after 10 minutes
    expires_at = datetime.now() + timedelta(minutes=10)
    
    try:
        sso_state = SSOState(
            state=state,
            provider=provider,
            user_id=user_id,
            expires_at=expires_at
        )
        db.add(sso_state)
        db.commit()
        
        logger.info(f"Generated state for provider {provider}, expires at {expires_at}")
        return state
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to generate state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate authentication state"
        )


def verify_state(db: Session, state: str, provider: str) -> Optional[int]:
    """
    Verify a state parameter and return the associated user ID if any.
    
    This function validates that:
    1. The state exists in the database
    2. The state matches the expected provider
    3. The state has not expired
    
    After successful verification, the state is deleted (one-time use).
    
    Args:
        db: Database session
        state: The state parameter to verify
        provider: Expected OAuth2 provider name
        
    Returns:
        User ID if this is an account linking flow, None otherwise
        
    Raises:
        HTTPException: If state is invalid, expired, or doesn't match provider
    """
    from app.database import SSOState
    
    try:
        sso_state = db.query(SSOState).filter(
            SSOState.state == state,
            SSOState.provider == provider
        ).first()
        
        if not sso_state:
            logger.warning(f"Invalid state parameter for provider {provider}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter. This may be a CSRF attack attempt."
            )
        
        # Check if state has expired
        if sso_state.expires_at < datetime.now():
            logger.warning(f"Expired state parameter for provider {provider}")
            db.delete(sso_state)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State parameter has expired. Please try logging in again."
            )
        
        # State is valid, get user_id and delete it (one-time use)
        user_id = sso_state.user_id
        db.delete(sso_state)
        db.commit()
        
        logger.info(f"Successfully verified state for provider {provider}")
        return user_id
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to verify state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify authentication state"
        )


def cleanup_expired_states(db: Session) -> int:
    """
    Clean up expired state parameters from the database.
    
    This function should be called periodically (e.g., every 10 minutes)
    to remove expired state entries and prevent database bloat.
    
    Args:
        db: Database session
        
    Returns:
        Number of expired states deleted
    """
    from app.database import SSOState
    
    try:
        expired_count = db.query(SSOState).filter(
            SSOState.expires_at < datetime.now()
        ).delete()
        
        db.commit()
        
        if expired_count > 0:
            logger.info(f"Cleaned up {expired_count} expired SSO states")
        
        return expired_count
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to cleanup expired states: {e}")
        return 0
