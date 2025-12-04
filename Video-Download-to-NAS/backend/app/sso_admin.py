"""
SSO Admin Settings Router

This module provides admin endpoints for managing SSO provider settings.
Only accessible by super_admin users.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import logging
from cryptography.fernet import Fernet

from ..database import get_db, User, SSOSettings
from ..auth import require_role
from ..sso.security import encrypt_client_secret
from ..models import SSOProviderSettingsUpdate, SSOProviderSettingsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/sso", tags=["sso-admin"])


@router.get("/settings")
async def get_sso_settings(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Get all SSO provider settings (super_admin only).
    
    Full path: GET /api/admin/sso/settings
    
    This endpoint returns all SSO provider configurations without
    exposing sensitive information like client secrets.
    
    Args:
        current_user: Currently authenticated super_admin user
        db: Database session
        
    Returns:
        Dictionary with provider settings keyed by provider name
        
    Raises:
        HTTPException: If user is not super_admin
    """
    try:
        # Query all SSO settings
        all_settings = db.query(SSOSettings).all()
        
        # Convert to dictionary format expected by frontend
        settings_dict = {}
        for setting in all_settings:
            settings_dict[setting.provider] = {
                "provider": setting.provider,
                "provider_type": setting.provider_type,
                "enabled": bool(setting.enabled),  # 명시적으로 boolean 변환
                "client_id": setting.client_id,
                "redirect_uri": setting.redirect_uri,
                "scopes": setting.scopes,
                "authorization_url": setting.authorization_url,
                "token_url": setting.token_url,
                "userinfo_url": setting.userinfo_url,
                "discovery_url": setting.discovery_url,
                "display_name": setting.display_name,
                "icon_url": setting.icon_url,
                "created_at": setting.created_at.isoformat() if setting.created_at else None,
                "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
            }
        
        return settings_dict
        
    except Exception as e:
        logger.error(f"Error fetching SSO settings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch SSO settings"
        )


@router.put("/settings/{provider}")
async def update_sso_settings(
    provider: str,
    settings: SSOProviderSettingsUpdate,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Update SSO provider settings (super_admin only).
    
    Full path: PUT /api/admin/sso/settings/{provider}
    
    This endpoint allows super_admin to configure SSO providers by
    updating their settings including client credentials and endpoints.
    
    Args:
        provider: Provider name to update
        settings: New settings for the provider
        current_user: Currently authenticated super_admin user
        db: Database session
        
    Returns:
        Updated provider settings
        
    Raises:
        HTTPException: If validation fails or provider not found
    """
    try:
        # Validate required fields when enabling
        if settings.enabled:
            if not settings.client_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Client ID is required when enabling SSO provider"
                )
            if not settings.client_secret:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Client Secret is required when enabling SSO provider"
                )
        
        # Get existing settings or create new one
        sso_settings = db.query(SSOSettings).filter(
            SSOSettings.provider == provider
        ).first()
        
        if not sso_settings:
            # Create new provider (for generic OIDC providers)
            logger.info(f"Creating new SSO provider: {provider}")
            sso_settings = SSOSettings(
                provider=provider,
                provider_type=settings.provider_type or "oidc",
                enabled=0,
                display_name=settings.display_name or provider,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(sso_settings)
        
        # Update settings
        sso_settings.enabled = 1 if settings.enabled else 0
        
        if settings.client_id is not None:
            sso_settings.client_id = settings.client_id
        
        # Encrypt and store client secret if provided
        if settings.client_secret is not None:
            sso_settings.client_secret_encrypted = encrypt_client_secret(settings.client_secret)
        
        if settings.redirect_uri is not None:
            sso_settings.redirect_uri = settings.redirect_uri
        
        if settings.scopes is not None:
            sso_settings.scopes = settings.scopes
        
        if settings.authorization_url is not None:
            sso_settings.authorization_url = settings.authorization_url
        
        if settings.token_url is not None:
            sso_settings.token_url = settings.token_url
        
        if settings.userinfo_url is not None:
            sso_settings.userinfo_url = settings.userinfo_url
        
        if settings.discovery_url is not None:
            sso_settings.discovery_url = settings.discovery_url
        
        if settings.display_name is not None:
            sso_settings.display_name = settings.display_name
        
        if settings.icon_url is not None:
            sso_settings.icon_url = settings.icon_url
        
        # Update timestamp
        sso_settings.updated_at = datetime.now()
        
        db.commit()
        db.refresh(sso_settings)
        
        logger.info(f"Updated SSO settings for provider {provider} by user {current_user.username}")
        
        return {
            "status": "success",
            "message": f"Successfully updated {provider} SSO settings",
            "provider": {
                "provider": sso_settings.provider,
                "provider_type": sso_settings.provider_type,
                "enabled": bool(sso_settings.enabled),  # 명시적으로 boolean 변환
                "client_id": sso_settings.client_id,
                "redirect_uri": sso_settings.redirect_uri,
                "scopes": sso_settings.scopes,
                "authorization_url": sso_settings.authorization_url,
                "token_url": sso_settings.token_url,
                "userinfo_url": sso_settings.userinfo_url,
                "discovery_url": sso_settings.discovery_url,
                "display_name": sso_settings.display_name,
                "icon_url": sso_settings.icon_url,
                "created_at": sso_settings.created_at.isoformat() if sso_settings.created_at else None,
                "updated_at": sso_settings.updated_at.isoformat() if sso_settings.updated_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating SSO settings for {provider}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update SSO settings"
        )


@router.post("/generate-encryption-key")
async def generate_encryption_key(
    current_user: User = Depends(require_role(["super_admin"]))
):
    """
    Generate a new Fernet encryption key for SSO (super_admin only).
    
    Full path: POST /api/admin/sso/generate-encryption-key
    
    This endpoint generates a cryptographically secure encryption key
    that can be used as SSO_ENCRYPTION_KEY in the .env file.
    
    The key is generated using Fernet.generate_key() which creates
    a 32-byte key encoded in base64 (44 characters).
    
    Args:
        current_user: Currently authenticated super_admin user
        
    Returns:
        Generated encryption key
        
    Raises:
        HTTPException: If user is not super_admin
    """
    try:
        # Generate a new Fernet key
        new_key = Fernet.generate_key().decode()
        
        logger.info(f"Generated new SSO encryption key for user {current_user.username}")
        
        return {
            "status": "success",
            "encryption_key": new_key,
            "message": "New encryption key generated successfully. Copy this key to your .env file as SSO_ENCRYPTION_KEY and restart the application."
        }
        
    except Exception as e:
        logger.error(f"Error generating encryption key: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate encryption key"
        )


@router.delete("/settings/{provider}")
async def delete_sso_provider(
    provider: str,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Delete SSO provider (super_admin only).
    
    Full path: DELETE /api/admin/sso/settings/{provider}
    
    This endpoint allows super_admin to completely delete a custom SSO provider.
    Built-in providers (google, microsoft, github, synology, authentik) cannot be deleted.
    
    Args:
        provider: Provider name to delete
        current_user: Currently authenticated super_admin user
        db: Database session
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If provider not found or is a built-in provider
    """
    try:
        # Prevent deletion of built-in providers
        builtin_providers = ['google', 'microsoft', 'github', 'synology', 'authentik']
        if provider in builtin_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete built-in provider: {provider}"
            )
        
        # Get existing settings
        sso_settings = db.query(SSOSettings).filter(
            SSOSettings.provider == provider
        ).first()
        
        if not sso_settings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider '{provider}' not found"
            )
        
        # Delete the provider
        db.delete(sso_settings)
        db.commit()
        
        logger.info(f"Deleted SSO provider {provider} by user {current_user.username}")
        
        return {
            "status": "success",
            "message": f"Successfully deleted {provider} SSO provider"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting SSO provider {provider}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete SSO provider"
        )
