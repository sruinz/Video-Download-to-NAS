"""
SSO User Management Functions

This module provides functions for managing user accounts in SSO authentication flows:
- Creating or retrieving users from SSO providers
- Linking SSO providers to existing accounts
- Creating JWT tokens with SSO information
"""

from sqlalchemy.orm import Session
from typing import Dict, Optional
from datetime import datetime, timedelta
import secrets
import logging
import random
import string

from ..database import User
from ..auth import get_password_hash, create_access_token
from ..settings_helper import get_setting, get_bool_setting

logger = logging.getLogger(__name__)


def generate_unique_display_name(db: Session, base_name: str, max_length: int = 20) -> str:
    """
    Generate a unique display name by checking for conflicts and adding suffix if needed.
    
    Args:
        db: Database session
        base_name: Base name to use (e.g., username or email prefix)
        max_length: Maximum length for display name (default 20)
    
    Returns:
        Unique display name
    """
    # Truncate base name if too long (leave room for suffix)
    if len(base_name) > max_length - 5:  # Reserve 5 chars for suffix like "_a1b2"
        base_name = base_name[:max_length - 5]
    
    # Check if base name is available
    candidate = base_name
    
    # Check against existing display_names and usernames
    existing = db.query(User).filter(
        (User.display_name == candidate) | (User.username == candidate)
    ).first()
    
    if not existing:
        return candidate
    
    # If conflict, add random suffix
    for attempt in range(10):  # Try up to 10 times
        # Generate random suffix (4 chars: lowercase + digits)
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        candidate = f"{base_name}_{suffix}"
        
        # Ensure it fits within max_length
        if len(candidate) > max_length:
            base_name = base_name[:max_length - 5]
            candidate = f"{base_name}_{suffix}"
        
        # Check if this candidate is available
        existing = db.query(User).filter(
            (User.display_name == candidate) | (User.username == candidate)
        ).first()
        
        if not existing:
            return candidate
    
    # Fallback: use timestamp-based suffix
    timestamp_suffix = str(int(datetime.now().timestamp()))[-4:]
    candidate = f"{base_name}_{timestamp_suffix}"
    if len(candidate) > max_length:
        candidate = candidate[:max_length]
    
    return candidate


def create_or_get_user_from_sso(
    db: Session,
    provider: str,
    external_id: str,
    user_info: Dict
) -> User:
    """
    Create or retrieve a user from SSO authentication.
    
    This function implements the following logic:
    1. Search for existing user by provider and external_id
    2. If not found, search by email
    3. If found by email, link the SSO provider to existing account
    4. If not found at all, create new user with SSO information
    5. First user gets super_admin role, others get default role
    6. Apply default role and quota settings
    
    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
    
    Args:
        db: Database session
        provider: OAuth2 provider name (google, microsoft, github, etc.)
        external_id: Provider's unique user ID
        user_info: Dictionary containing user information from provider
                   Expected keys: email, name (optional), verified_email (optional)
    
    Returns:
        User object (either existing or newly created)
        
    Raises:
        ValueError: If required user information is missing
        Exception: If registration is disabled and user doesn't exist
    """
    email = user_info.get("email")
    name = user_info.get("name", email.split("@")[0] if email else "User")
    email_verified = user_info.get("verified_email", True)
    
    if not email:
        raise ValueError("Email is required from SSO provider")
    
    # Step 1: Check if user exists with this provider and external_id
    user = db.query(User).filter(
        User.auth_provider == provider,
        User.external_id == external_id
    ).first()
    
    if user:
        # User found with SSO credentials - check if active (approved)
        if not user.is_active:
            logger.warning(f"SSO user {user.username} is not active (pending approval)")
            raise Exception("SSO_ACCOUNT_PENDING_APPROVAL")
        
        # User is active - update last login
        user.last_login = datetime.now()
        db.commit()
        db.refresh(user)
        logger.info(f"Found existing SSO user: {user.username} (provider: {provider})")
        return user
    
    # Step 2: Check if user exists with this email (any provider)
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        # User exists with same email but different provider
        # Check if active before linking
        if not user.is_active:
            logger.warning(f"User {user.username} is not active (pending approval)")
            raise Exception("SSO_ACCOUNT_PENDING_APPROVAL")
        
        # Link this provider to existing account
        logger.info(f"Linking {provider} to existing user {user.username} by email match")
        user.auth_provider = provider
        user.external_id = external_id
        user.email_verified = 1 if email_verified else 0
        user.last_login = datetime.now()
        
        db.commit()
        db.refresh(user)
        return user
    
    # Step 3: User doesn't exist - check if registration is allowed
    allow_registration = get_bool_setting(db, "allow_registration", True)
    
    if not allow_registration:
        logger.warning(f"Registration disabled, rejecting SSO user: {email}")
        raise Exception("Registration is disabled. Please contact administrator.")
    
    # Step 4: Create new user
    logger.info(f"Creating new user via {provider} SSO: {email}")
    
    # Generate random password (user won't use it for SSO login)
    random_password = secrets.token_urlsafe(32)
    
    # Step 5: Determine if this is the first user (gets super_admin role)
    user_count = db.query(User).count()
    is_first_user = user_count == 0
    
    if is_first_user:
        role = "super_admin"
        quota = 100  # Super admin gets 100GB
        logger.info(f"First user detected - assigning super_admin role to {email}")
    else:
        # Step 6: Apply default role and quota from settings
        role = get_setting(db, "default_user_role", "user")
        if role == "admin":
            quota = int(get_setting(db, "admin_quota_gb", "10"))
        else:
            quota = int(get_setting(db, "default_user_quota_gb", "1"))
    
    # Step 7: Create user with SSO information
    # Generate unique default display name from email (part before @)
    base_display_name = email.split('@')[0] if email else "user"
    default_display_name = generate_unique_display_name(db, base_display_name)
    
    # Get default permissions for this role from role_permissions table
    from ..database import RolePermissions
    role_perms = db.query(RolePermissions).filter(RolePermissions.role == role).first()
    
    # Determine is_active based on admin approval setting
    # First user is always active (super_admin)
    # Others depend on require_admin_approval setting
    require_approval = get_bool_setting(db, "require_admin_approval", False)
    is_active = 1 if is_first_user else (0 if require_approval else 1)
    
    user = User(
        username=email,  # Use email as username for SSO users
        email=email,
        display_name=default_display_name,  # Set unique default display name
        hashed_password=get_password_hash(random_password),
        role=role,
        is_active=is_active,  # Apply approval setting
        storage_quota_gb=quota,
        auth_provider=provider,
        external_id=external_id,
        email_verified=1 if email_verified else 0,
        last_login=datetime.now()
    )
    
    # Set all permissions to 0 (use role default)
    # This allows role_permissions changes to automatically apply
    # Admin can override by setting explicit values (1=allow, 2=deny)
    user.can_download_to_nas = 0  # Use role default
    user.can_download_from_nas = 0  # Use role default
    user.can_create_share_links = 0  # Use role default
    user.can_view_public_board = 0  # Use role default
    user.can_post_to_public_board = 0  # Use role default
    user.can_use_telegram_bot = 0  # Use role default
    
    logger.info(f"Created user {email} with role {role}, permissions set to use role defaults")
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info(f"Successfully created user {user.username} with role {role} and quota {quota}GB")
    
    # Check if user needs approval before allowing login
    if not user.is_active:
        logger.warning(f"New SSO user {user.username} created but pending approval")
        raise Exception("SSO_ACCOUNT_CREATED_PENDING_APPROVAL")
    
    return user


def link_sso_to_user(
    db: Session,
    user: User,
    provider: str,
    external_id: str,
    sso_email: str
) -> User:
    """
    Link an SSO provider to an existing user account.
    
    This function:
    1. Validates that the SSO email matches the user's email
    2. Updates the user's auth_provider and external_id
    3. Marks email as verified if not already
    
    Requirements: 6.3, 6.4
    
    Args:
        db: Database session
        user: Existing user object to link SSO to
        provider: OAuth2 provider name
        external_id: Provider's unique user ID
        sso_email: Email address from SSO provider
        
    Returns:
        Updated user object
        
    Raises:
        ValueError: If email doesn't match user's email
    """
    # Email validation - ensure SSO email matches user's email
    if user.email and user.email.lower() != sso_email.lower():
        logger.warning(
            f"Email mismatch during account linking: "
            f"user.email={user.email}, sso_email={sso_email}"
        )
        raise ValueError(
            "Email mismatch. The SSO account email must match your account email."
        )
    
    # Update user with SSO information
    user.auth_provider = provider
    user.external_id = external_id
    user.email_verified = 1  # SSO providers verify emails
    
    # Set email if not already set
    if not user.email:
        user.email = sso_email
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"Successfully linked {provider} to user {user.username}")
    
    return user


def create_access_token_with_sso(user: User) -> str:
    """
    Create JWT access token with SSO information included.
    
    This function creates a JWT token with additional claims for SSO:
    - auth_provider: The authentication provider used
    - email_verified: Whether the email has been verified
    
    Requirements: 1.5
    
    Args:
        user: User object to create token for
        
    Returns:
        JWT token string
    """
    # Create token data with SSO claims
    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "auth_provider": user.auth_provider,
        "email_verified": bool(user.email_verified)
    }
    
    # Create and return JWT token
    token = create_access_token(data=token_data)
    
    logger.debug(f"Created JWT token for user {user.username} with provider {user.auth_provider}")
    
    return token
