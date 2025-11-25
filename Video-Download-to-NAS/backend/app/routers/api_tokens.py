"""
API Token Management Router

Endpoints for creating, listing, updating, and revoking API tokens
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, User, APIToken
from ..auth import get_current_user
from ..token_utils import generate_api_token, hash_token, get_token_prefix
from ..models import APITokenCreate, APITokenUpdate, APITokenResponse, APITokenCreateResponse

router = APIRouter(prefix="/api/tokens", tags=["api-tokens"])


# === API Endpoints ===

@router.post("/", response_model=APITokenCreateResponse)
async def create_token(
    token_data: APITokenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new API token
    
    Returns the full token (shown only once!)
    Maximum 10 active tokens per user
    """
    import os
    
    # Check token limit (max 10 per user)
    active_tokens = db.query(APIToken).filter(
        APIToken.user_id == current_user.id,
        APIToken.is_active == 1
    ).count()
    
    if active_tokens >= 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of tokens (10) reached"
        )
    
    # Generate token
    plain_token = generate_api_token()
    token_hash = hash_token(plain_token)
    token_prefix = get_token_prefix(plain_token)
    
    # Save to database
    db_token = APIToken(
        user_id=current_user.id,
        name=token_data.name,
        token_hash=token_hash,
        token_prefix=token_prefix
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    # Get server URL from environment or use default
    server_url = os.getenv("SERVER_URL", "http://localhost:3000")
    # Remove trailing slash if present
    server_url = server_url.rstrip('/')
    
    # Create config URL (server_url#token)
    config_url = f"{server_url}#{plain_token}"
    
    # Return with full token (only time it's shown!)
    return APITokenCreateResponse(
        id=db_token.id,
        name=db_token.name,
        token=plain_token,  # Full token
        token_prefix=token_prefix,
        config_url=config_url,  # 원클릭 설정 URL
        created_at=db_token.created_at
    )


@router.get("/", response_model=List[APITokenResponse])
async def list_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API tokens for current user"""
    tokens = db.query(APIToken).filter(
        APIToken.user_id == current_user.id
    ).order_by(APIToken.created_at.desc()).all()
    
    # Convert to response model with is_active as boolean
    return [
        APITokenResponse(
            id=token.id,
            name=token.name,
            token_prefix=token.token_prefix,
            created_at=token.created_at,
            last_used_at=token.last_used_at,
            is_active=bool(token.is_active)
        )
        for token in tokens
    ]


@router.delete("/{token_id}")
async def revoke_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke (delete) an API token"""
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.user_id == current_user.id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    # Hard delete (remove from database)
    db.delete(token)
    db.commit()
    
    return {"message": "Token revoked successfully"}


@router.put("/{token_id}", response_model=APITokenResponse)
async def update_token(
    token_id: int,
    token_update: APITokenUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update token metadata (name only)"""
    token = db.query(APIToken).filter(
        APIToken.id == token_id,
        APIToken.user_id == current_user.id
    ).first()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    # Update name if provided
    if token_update.name:
        token.name = token_update.name
    
    db.commit()
    db.refresh(token)
    
    # Return response with is_active as boolean
    return APITokenResponse(
        id=token.id,
        name=token.name,
        token_prefix=token.token_prefix,
        created_at=token.created_at,
        last_used_at=token.last_used_at,
        is_active=bool(token.is_active)
    )
