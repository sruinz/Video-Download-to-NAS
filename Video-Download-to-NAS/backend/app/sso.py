"""
SSO Authentication Router

This module provides endpoints for SSO authentication including:
- SSO login initiation
- SSO callback handling
- Account linking/unlinking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import logging
import os

from ..database import get_db, User, SSOSettings
from ..auth import get_current_user, create_access_token
from ..sso.security import generate_state, verify_state, decrypt_client_secret
from ..sso.google_provider import GoogleProvider
from ..sso.microsoft_provider import MicrosoftProvider
from ..sso.github_provider import GitHubProvider
from ..sso.synology_provider import SynologyProvider
from ..sso.authentik_provider import AuthentikProvider
from ..sso.generic_oidc_provider import GenericOIDCProvider
from ..sso.user_management import (
    create_or_get_user_from_sso,
    link_sso_to_user,
    create_access_token_with_sso
)
from ..sso.exceptions import (
    SSOAuthenticationError,
    SSOStateError,
    SSOEmailMismatchError,
    SSOProviderNotConfiguredError,
    SSORegistrationDisabledError,
    SSOProviderNotFoundError,
    SSOAlreadyLinkedError,
    SSONotLinkedError,
    SSOUserInfoError,
    SSOTokenExchangeError,
    SSONetworkError
)
from ..settings_helper import get_bool_setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["sso"])

# Get frontend URL from environment
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
# Get backend URL from environment for redirect URIs
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def get_base_url_from_request(request: Request) -> str:
    """
    Get base URL from request, respecting X-Forwarded-* headers from reverse proxy.
    
    This handles cases where the app is behind a reverse proxy (like NPM) that
    terminates HTTPS and forwards HTTP to the backend.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Base URL with correct scheme and host
    """
    # Check X-Forwarded-Proto header (set by reverse proxy)
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    
    if forwarded_proto and forwarded_host:
        # Use forwarded headers from reverse proxy
        return f"{forwarded_proto}://{forwarded_host}"
    
    # Fallback to BACKEND_URL from environment
    return BACKEND_URL


def get_redirect_uri(provider_name: str, request: Request = None) -> str:
    """
    Generate redirect URI based on request or BACKEND_URL environment variable.
    
    Args:
        provider_name: Name of the provider (google, microsoft, github, etc.)
        request: Optional FastAPI request object to detect reverse proxy headers
        
    Returns:
        Complete redirect URI for the provider
    """
    if request:
        base_url = get_base_url_from_request(request)
    else:
        base_url = BACKEND_URL
    
    return f"{base_url}/api/sso/{provider_name}/callback"


def get_provider_instance(provider_name: str, settings: SSOSettings, request: Request = None):
    """
    Get OAuth2 provider instance based on provider name and settings.
    
    Args:
        provider_name: Name of the provider (google, microsoft, github, etc.)
        settings: SSO settings from database
        request: Optional FastAPI request object to detect reverse proxy headers
        
    Returns:
        OAuth2Provider instance
        
    Raises:
        SSOProviderNotConfiguredError: If provider is not properly configured
        HTTPException: If provider is not supported
    """
    if not settings.client_id or not settings.client_secret_encrypted:
        raise SSOProviderNotConfiguredError(provider_name)
    
    try:
        # Decrypt client secret
        client_secret = decrypt_client_secret(settings.client_secret_encrypted)
    except Exception as e:
        logger.error(f"Failed to decrypt client secret for {provider_name}: {e}")
        raise SSOProviderNotConfiguredError(provider_name)
    
    # Generate redirect URI dynamically, respecting reverse proxy headers
    redirect_uri = get_redirect_uri(provider_name, request)
    
    # Create provider instance based on type
    if provider_name == "google":
        return GoogleProvider(
            client_id=settings.client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri
        )
    elif provider_name == "microsoft":
        return MicrosoftProvider(
            client_id=settings.client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri
        )
    elif provider_name == "github":
        return GitHubProvider(
            client_id=settings.client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri
        )
    elif provider_name == "synology":
        # If discovery_url is provided but endpoints are not, fetch them
        authorization_url = settings.authorization_url
        token_url = settings.token_url
        userinfo_url = settings.userinfo_url
        
        if settings.discovery_url and not (authorization_url and token_url and userinfo_url):
            # Fetch endpoints from discovery URL
            import httpx
            try:
                response = httpx.get(settings.discovery_url, verify=False, timeout=10.0)
                response.raise_for_status()
                discovery_data = response.json()
                
                authorization_url = discovery_data.get("authorization_endpoint")
                token_url = discovery_data.get("token_endpoint")
                userinfo_url = discovery_data.get("userinfo_endpoint")
                
                logger.info(f"Fetched Synology endpoints from discovery URL")
                logger.info(f"Authorization: {authorization_url}")
                logger.info(f"Token: {token_url}")
                logger.info(f"UserInfo: {userinfo_url}")
            except Exception as e:
                logger.error(f"Failed to fetch discovery document: {e}")
                raise SSOProviderNotConfiguredError(provider_name)
        
        # Extract domain from discovery_url or authorization_url if available
        synology_domain = ""
        if settings.discovery_url:
            from urllib.parse import urlparse
            parsed = urlparse(settings.discovery_url)
            synology_domain = f"{parsed.scheme}://{parsed.netloc}"
        elif authorization_url:
            from urllib.parse import urlparse
            parsed = urlparse(authorization_url)
            synology_domain = f"{parsed.scheme}://{parsed.netloc}"
        
        return SynologyProvider(
            client_id=settings.client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            synology_domain=synology_domain,
            discovery_url=settings.discovery_url,
            authorization_url=authorization_url,
            token_url=token_url,
            userinfo_url=userinfo_url
        )
    elif provider_name == "authentik":
        # Extract domain from authorization_url if available
        authentik_domain = ""
        if settings.authorization_url:
            from urllib.parse import urlparse
            parsed = urlparse(settings.authorization_url)
            authentik_domain = f"{parsed.scheme}://{parsed.netloc}"
        
        return AuthentikProvider(
            client_id=settings.client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            authentik_domain=authentik_domain,
            discovery_url=settings.discovery_url,
            authorization_url=settings.authorization_url,
            token_url=settings.token_url,
            userinfo_url=settings.userinfo_url
        )
    else:
        # Check if it's a generic OIDC provider by provider_type
        if settings.provider_type == "oidc" or settings.provider_type == "generic_oidc":
            # Generic OIDC provider
            return GenericOIDCProvider(
                client_id=settings.client_id,
                client_secret=client_secret,
                redirect_uri=redirect_uri,
                discovery_url=settings.discovery_url,
                authorization_url=settings.authorization_url,
                token_url=settings.token_url,
                userinfo_url=settings.userinfo_url
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported provider: {provider_name}"
            )


@router.get("/{provider}/login")
async def sso_login(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Initiate SSO login flow.
    
    This endpoint:
    1. Validates that the provider is enabled
    2. Generates a secure state parameter
    3. Redirects user to the OAuth2 provider's authorization page
    
    Args:
        provider: OAuth2 provider name (google, microsoft, github, etc.)
        request: FastAPI request object (for rate limiting)
        db: Database session
        
    Returns:
        RedirectResponse to OAuth2 provider's authorization page
        
    Raises:
        SSOProviderNotFoundError: If provider doesn't exist
        SSOProviderNotConfiguredError: If provider is disabled or not configured
    """
    # Get provider settings
    sso_settings = db.query(SSOSettings).filter(
        SSOSettings.provider == provider
    ).first()
    
    if not sso_settings:
        raise SSOProviderNotFoundError(provider)
    
    if not sso_settings.enabled:
        raise SSOProviderNotConfiguredError(provider)
    
    try:
        # Generate state parameter for CSRF protection
        state = generate_state(db, provider, user_id=None)
        
        # Get provider instance (pass request to detect reverse proxy headers)
        provider_instance = get_provider_instance(provider, sso_settings, request)
        
        # Get authorization URL (await if async)
        auth_url = provider_instance.get_authorization_url(state)
        if hasattr(auth_url, '__await__'):
            auth_url = await auth_url
        
        logger.info(f"SSO login initiated for provider: {provider}")
        logger.info(f"Redirecting to authorization URL: {auth_url}")
        logger.info(f"Redirect URI used: {provider_instance.redirect_uri}")
        
        # Redirect to OAuth2 provider
        return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
        
    except (SSOProviderNotFoundError, SSOProviderNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"SSO login error for provider {provider}: {e}", exc_info=True)
        raise SSOAuthenticationError(provider, "Failed to initiate login")


@router.get("/{provider}/callback")
async def sso_callback(
    provider: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Handle SSO callback from OAuth2 provider.
    
    This endpoint:
    1. Validates the state parameter (CSRF protection)
    2. Exchanges authorization code for access token
    3. Retrieves user information from provider
    4. Creates or updates user account
    5. Issues JWT token
    6. Redirects to frontend with token
    
    Args:
        provider: OAuth2 provider name
        code: Authorization code from OAuth2 provider
        state: State parameter for CSRF validation
        error: Error code if OAuth2 flow failed
        error_description: Human-readable error description
        db: Database session
        
    Returns:
        RedirectResponse to frontend with JWT token or error
    """
    # Check for OAuth2 errors from provider
    if error:
        error_msg = error_description or error
        logger.warning(f"SSO callback error for {provider}: {error_msg}")
        
        # Map common OAuth2 errors to user-friendly messages
        user_friendly_error = error_msg
        if "access_denied" in error.lower():
            user_friendly_error = "You denied access to your account. Please try again if you want to sign in."
        elif "invalid_request" in error.lower():
            user_friendly_error = "Invalid authentication request. Please try again."
        elif "server_error" in error.lower():
            user_friendly_error = f"{provider} is experiencing issues. Please try again later."
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error={user_friendly_error}",
            status_code=status.HTTP_302_FOUND
        )
    
    if not code or not state:
        logger.warning(f"SSO callback missing code or state for {provider}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=Invalid authentication response. Please try again.",
            status_code=status.HTTP_302_FOUND
        )
    
    try:
        # Verify state parameter (CSRF protection)
        try:
            linking_user_id = verify_state(db, state, provider)
        except Exception as e:
            logger.warning(f"State verification failed for {provider}: {e}")
            raise SSOStateError()
        
        # Get provider settings
        sso_settings = db.query(SSOSettings).filter(
            SSOSettings.provider == provider
        ).first()
        
        if not sso_settings or not sso_settings.enabled:
            raise SSOProviderNotConfiguredError(provider)
        
        # Get provider instance (pass request to detect reverse proxy headers)
        provider_instance = get_provider_instance(provider, sso_settings, request)
        
        # Exchange code for access token
        try:
            access_token = await provider_instance.exchange_code_for_token(code)
        except Exception as e:
            logger.error(f"Token exchange failed for {provider}: {e}", exc_info=True)
            raise SSOTokenExchangeError(provider, str(e))
        
        # Get user info from provider
        try:
            user_info = await provider_instance.get_user_info(access_token)
        except Exception as e:
            logger.error(f"Failed to get user info from {provider}: {e}", exc_info=True)
            raise SSONetworkError(provider)
        
        email = user_info.get("email")
        username = user_info.get("username") or user_info.get("preferred_username")
        external_id = user_info.get("id")
        email_verified = user_info.get("verified_email", True)
        
        # Generate fallback email if not provided (e.g., Synology accounts without email)
        if not email:
            if username:
                # Use username as email fallback
                email = f"{username}@{provider}.local"
                logger.info(f"No email from {provider}, using fallback: {email}")
            elif external_id:
                # Use external_id as last resort
                email = f"{external_id}@{provider}.local"
                logger.info(f"No email/username from {provider}, using external_id fallback: {email}")
        
        # Get display name
        name = user_info.get("name") or username or (email.split("@")[0] if email else "User")
        
        # Validate required user information
        missing_fields = []
        if not email:
            missing_fields.append("email or username")
        if not external_id:
            missing_fields.append("id")
        
        if missing_fields:
            raise SSOUserInfoError(provider, missing_fields)
        
        # Handle account linking vs new login
        if linking_user_id:
            # This is an account linking flow
            user = db.query(User).filter(User.id == linking_user_id).first()
            
            if not user:
                logger.error(f"User {linking_user_id} not found for account linking")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?error=User account not found",
                    status_code=status.HTTP_302_FOUND
                )
            
            try:
                # Use the link_sso_to_user function
                user = link_sso_to_user(
                    db=db,
                    user=user,
                    provider=provider,
                    external_id=external_id,
                    sso_email=email
                )
                
                logger.info(f"Linked {provider} account to user {user.username}")
                
                # Create JWT token with SSO information
                jwt_token = create_access_token_with_sso(user)
                
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?success=Account linked successfully",
                    status_code=status.HTTP_302_FOUND
                )
                
            except ValueError as e:
                # Email mismatch error
                logger.warning(f"Account linking failed: {str(e)}")
                error_msg = str(e)
                if "mismatch" in error_msg.lower():
                    error_msg = f"Email mismatch: The {provider} account email does not match your account email"
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?error={error_msg}",
                    status_code=status.HTTP_302_FOUND
                )
        
        else:
            # This is a login/registration flow
            try:
                # Use the create_or_get_user_from_sso function
                user = create_or_get_user_from_sso(
                    db=db,
                    provider=provider,
                    external_id=external_id,
                    user_info={
                        "email": email,
                        "name": name,
                        "verified_email": email_verified
                    }
                )
                
                # Create JWT token with SSO information
                jwt_token = create_access_token_with_sso(user)
                
                logger.info(f"SSO login successful for user {user.username} via {provider}")
                
                # Redirect to frontend with token
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/?token={jwt_token}",
                    status_code=status.HTTP_302_FOUND
                )
                
            except ValueError as e:
                # Missing required information
                error_msg = str(e)
                logger.warning(f"SSO login failed - invalid data: {error_msg}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/login?error={error_msg}",
                    status_code=status.HTTP_302_FOUND
                )
            except Exception as e:
                # Handle registration disabled or other errors
                error_msg = str(e)
                logger.warning(f"SSO login/registration failed: {error_msg}")
                
                # Provide user-friendly error messages
                # Check for error codes first (keep original error code for i18n)
                if error_msg.startswith("SSO_"):
                    # This is an error code for frontend i18n - keep it as is
                    pass
                elif "disabled" in error_msg.lower():
                    error_msg = "Registration is disabled. Please contact administrator."
                elif "not found" in error_msg.lower():
                    error_msg = "Account not found. Please contact administrator."
                else:
                    error_msg = "Authentication failed. Please try again."
                
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/login?error={error_msg}",
                    status_code=status.HTTP_302_FOUND
                )
    
    except (SSOStateError, SSOProviderNotConfiguredError, SSOTokenExchangeError, 
            SSONetworkError, SSOUserInfoError) as e:
        # Known SSO errors - use their detail messages
        logger.error(f"SSO callback error for {provider}: {e.detail}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error={e.detail}",
            status_code=status.HTTP_302_FOUND
        )
    except HTTPException as e:
        # Other HTTP exceptions
        logger.error(f"SSO callback HTTP error: {e.detail}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error={e.detail}",
            status_code=status.HTTP_302_FOUND
        )
    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected SSO callback error for {provider}: {e}", exc_info=True)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=An unexpected error occurred. Please try again.",
            status_code=status.HTTP_302_FOUND
        )


@router.get("/{provider}/link")
async def link_sso_account(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Link an SSO provider to the current user's account.
    
    This endpoint initiates an OAuth2 flow similar to login, but with
    the user_id stored in the state parameter to indicate this is an
    account linking operation.
    
    Note: This is a GET endpoint to allow direct browser navigation.
    Authentication is handled via token in query parameter or cookie.
    
    Args:
        provider: OAuth2 provider name
        request: FastAPI request object
        db: Database session
        
    Returns:
        RedirectResponse to OAuth2 provider's authorization page
        
    Raises:
        SSOAlreadyLinkedError: If provider is already linked
        SSOProviderNotFoundError: If provider doesn't exist
        SSOProviderNotConfiguredError: If provider is disabled
    """
    # Get current user from token (query param or Authorization header)
    token = request.query_params.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        # Redirect to login if no token
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=Please login first",
            status_code=status.HTTP_302_FOUND
        )
    
    try:
        # Verify token and get user
        from ..auth import verify_token
        payload = verify_token(token)
        username = payload.get("sub")
        
        if not username:
            return RedirectResponse(
                url=f"{FRONTEND_URL}/login?error=Invalid token",
                status_code=status.HTTP_302_FOUND
            )
        
        current_user = db.query(User).filter(User.username == username).first()
        
        if not current_user:
            return RedirectResponse(
                url=f"{FRONTEND_URL}/login?error=User not found",
                status_code=status.HTTP_302_FOUND
            )
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/login?error=Authentication failed",
            status_code=status.HTTP_302_FOUND
        )
    # Check if user already has this provider linked
    if current_user.auth_provider == provider:
        raise SSOAlreadyLinkedError(provider)
    
    # Get provider settings
    sso_settings = db.query(SSOSettings).filter(
        SSOSettings.provider == provider
    ).first()
    
    if not sso_settings:
        raise SSOProviderNotFoundError(provider)
    
    if not sso_settings.enabled:
        raise SSOProviderNotConfiguredError(provider)
    
    try:
        # Generate state parameter with user_id for account linking
        state = generate_state(db, provider, user_id=current_user.id)
        
        # Get provider instance (pass request to detect reverse proxy headers)
        provider_instance = get_provider_instance(provider, sso_settings, request)
        
        # Get authorization URL (await if async)
        auth_url = provider_instance.get_authorization_url(state)
        if hasattr(auth_url, '__await__'):
            auth_url = await auth_url
        
        logger.info(f"Account linking initiated for user {current_user.username} with provider {provider}")
        
        # Redirect to OAuth2 provider
        return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
        
    except (SSOAlreadyLinkedError, SSOProviderNotFoundError, SSOProviderNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Account linking error for provider {provider}: {e}", exc_info=True)
        raise SSOAuthenticationError(provider, "Failed to initiate account linking")


@router.post("/{provider}/unlink")
async def unlink_sso_account(
    provider: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unlink an SSO provider from the current user's account.
    
    This removes the SSO provider association. If the user was created via SSO,
    they must provide a new password to enable local authentication.
    
    Args:
        provider: OAuth2 provider name to unlink
        data: Request data containing optional 'new_password' field
        current_user: Currently authenticated user
        db: Database session
        
    Returns:
        Success message
        
    Raises:
        SSONotLinkedError: If provider is not linked to this account
        HTTPException: If password is required but not provided
    """
    # Check if user has this provider linked
    if current_user.auth_provider != provider:
        raise SSONotLinkedError(provider)
    
    try:
        # Check if user needs to set a password
        # (users created via SSO have random passwords they don't know)
        new_password = data.get('new_password')
        
        # If user was created via SSO (username is email), require password
        if '@' in current_user.username and not new_password:
            raise HTTPException(
                status_code=400,
                detail="Password required. You must set a password before unlinking SSO account."
            )
        
        # Set new password if provided
        if new_password:
            from ..auth import get_password_hash
            current_user.hashed_password = get_password_hash(new_password)
            logger.info(f"Password set for user {current_user.username} during SSO unlink")
        
        # Remove SSO provider link (revert to local auth)
        current_user.auth_provider = "local"
        current_user.external_id = None
        
        db.commit()
        
        logger.info(f"Unlinked {provider} from user {current_user.username}")
        
        return {
            "status": "success",
            "message": f"Successfully unlinked {provider} from your account"
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Account unlinking error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unlink account. Please try again."
        )


@router.get("/providers")
async def get_enabled_providers(db: Session = Depends(get_db)):
    """
    Get list of enabled SSO providers.
    
    This is a public endpoint that returns information about which
    SSO providers are currently enabled and available for login.
    No authentication required.
    
    Args:
        db: Database session
        
    Returns:
        List of enabled provider information
    """
    try:
        # Query enabled providers
        enabled_providers = db.query(SSOSettings).filter(
            SSOSettings.enabled == 1
        ).all()
        
        # Return provider information (without sensitive data)
        providers = []
        for provider in enabled_providers:
            providers.append({
                "provider": provider.provider,
                "display_name": provider.display_name or provider.provider.capitalize(),
                "icon_url": provider.icon_url
            })
        
        return {
            "providers": providers
        }
        
    except Exception as e:
        logger.error(f"Error fetching enabled providers: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch SSO providers"
        )


@router.get("/redirect-uris")
async def get_redirect_uris(request: Request):
    """
    Get SSO redirect URIs for all providers based on current server URL
    
    Returns:
        Dictionary with provider redirect URIs
    """
    try:
        # Get base URL from request
        base_url = str(request.base_url).rstrip('/')
        
        # Generate redirect URIs for all supported providers
        providers = {
            "google": f"{base_url}/api/sso/google/callback",
            "microsoft": f"{base_url}/api/sso/microsoft/callback",
            "github": f"{base_url}/api/sso/github/callback",
            "synology": f"{base_url}/api/sso/synology/callback",
            "authentik": f"{base_url}/api/sso/authentik/callback",
        }
        
        # Add generic OIDC providers (they use oidc_{provider_id} format)
        # Note: These need to be configured with the actual provider_id
        
        return {
            "base_url": base_url,
            "providers": providers
        }
        
    except Exception as e:
        logger.error(f"Error generating redirect URIs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate redirect URIs"
        )

