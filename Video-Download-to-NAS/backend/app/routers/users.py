from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db, User
from ..models import UserRegister, UserInfo, UserUpdate, UserRoleUpdate, UserQuotaUpdate, UserRateLimitUpdate
from ..auth import get_password_hash, verify_password, get_current_user, require_role

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/register", response_model=UserInfo)
async def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    from ..settings_helper import get_bool_setting
    
    # Check if registration is allowed (DB setting overrides env var)
    allow_registration = get_bool_setting(db, "allow_registration", True)
    if not allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently disabled"
        )
    
    # Check if username exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email exists
    if user_data.email and db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    # Determine role (first user is super_admin)
    from ..settings_helper import get_setting
    
    user_count = db.query(User).count()
    is_first_user = user_count == 0
    
    if is_first_user:
        role = "super_admin"
        quota = 100
    else:
        role = get_setting(db, "default_user_role", "user")
        if role == "admin":
            quota = int(get_setting(db, "admin_quota_gb", "10"))
        else:
            quota = int(get_setting(db, "default_user_quota_gb", "1"))
    
    # Determine is_active based on admin approval setting
    # 첫 사용자는 항상 활성화 (super_admin)
    # 그 외에는 require_admin_approval 설정에 따라 결정
    require_approval = get_bool_setting(db, "require_admin_approval", False)
    is_active = 1 if is_first_user else (0 if require_approval else 1)
    
    # Generate unique default display name from username
    from ..sso.user_management import generate_unique_display_name
    default_display_name = generate_unique_display_name(db, user_data.username)
    
    # Get default permissions for this role from role_permissions table
    from ..database import RolePermissions
    role_perms = db.query(RolePermissions).filter(RolePermissions.role == role).first()
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        display_name=default_display_name,  # Set unique default display name
        hashed_password=hashed_password,
        role=role,
        is_active=is_active,  # 승인 모드에 따라 설정
        storage_quota_gb=quota
    )
    
    # Set all permissions to NULL (0) to use role defaults
    # This allows role_permissions changes to automatically apply
    # Admin can override by setting explicit values (1=allow, 2=deny)
    new_user.can_download_to_nas = 0  # Use role default
    new_user.can_download_from_nas = 0  # Use role default
    new_user.can_create_share_links = 0  # Use role default
    new_user.can_view_public_board = 0  # Use role default
    new_user.can_post_to_public_board = 0  # Use role default
    new_user.can_use_telegram_bot = 0  # Use role default
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    from ..permissions import get_user_permissions
    
    user_dict = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "is_active": bool(current_user.is_active),
        "storage_quota_gb": current_user.storage_quota_gb,
        "custom_rate_limit": current_user.custom_rate_limit,
        "created_at": current_user.created_at,
        "last_login": current_user.last_login,
        "permissions": get_user_permissions(current_user, db),  # Pass db session
        "auth_provider": current_user.auth_provider,
        "external_id": current_user.external_id
    }
    return user_dict

@router.put("/me", response_model=UserInfo)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user information.
    
    Password changes work for all users regardless of auth_provider:
    - Local users: Can change their password normally
    - SSO users: Can set/change password to enable local authentication fallback
    
    Changing password does not affect SSO authentication or account linking.
    """
    # Update email
    if user_update.email:
        # Check if email already exists
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        current_user.email = user_update.email
    
    # Update display name
    if user_update.display_name is not None:
        # Check if display name is being changed (not just same value)
        if user_update.display_name.strip() != (current_user.display_name or ""):
            new_display_name = user_update.display_name.strip()
            
            # Validate display name length (20 characters max for UI)
            if len(new_display_name) > 20:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Display name must be 20 characters or less"
                )
            
            # Check for duplicate display name or username conflict
            if new_display_name:
                # Check if another user has this as display_name
                existing_display = db.query(User).filter(
                    User.display_name == new_display_name,
                    User.id != current_user.id
                ).first()
                
                if existing_display:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="DISPLAY_NAME_TAKEN"
                    )
                
                # Check if this matches any username
                existing_username = db.query(User).filter(
                    User.username == new_display_name
                ).first()
                
                if existing_username:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="DISPLAY_NAME_CONFLICTS_USERNAME"
                    )
            
            # Check cooldown period (unless super_admin)
            if current_user.role != "super_admin":
                from ..settings_helper import get_setting
                
                cooldown_days = int(get_setting(db, "display_name_change_cooldown_days", "30"))
                
                if current_user.display_name_updated_at:
                    time_since_update = datetime.now() - current_user.display_name_updated_at
                    if time_since_update.days < cooldown_days:
                        days_remaining = cooldown_days - time_since_update.days
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Display name can only be changed once every {cooldown_days} days. Please wait {days_remaining} more days."
                        )
            
            # Update display name and timestamp
            current_user.display_name = new_display_name if new_display_name else None
            current_user.display_name_updated_at = datetime.now()
    
    # Update password
    # Works for both local and SSO users - SSO users can set password for local auth fallback
    if user_update.new_password:
        # Check if user has manually set a password before
        # password_set_at is None = never set (using random/initial password)
        # password_set_at has value = user has set password manually
        
        if current_user.auth_provider and current_user.auth_provider != 'local':
            # SSO user
            if current_user.password_set_at is None:
                # First time setting password - no current password needed
                if user_update.current_password:
                    # User provided current password anyway - verify it
                    if not verify_password(user_update.current_password, current_user.hashed_password):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect"
                        )
                # else: No current password needed for first-time setup
            else:
                # User has set password before - require current password
                if not user_update.current_password:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Current password is required"
                    )
                
                if not verify_password(user_update.current_password, current_user.hashed_password):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Current password is incorrect"
                    )
        else:
            # Local user - always require current password
            if not user_update.current_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is required"
                )
            
            if not verify_password(user_update.current_password, current_user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
        
        # Update password and set timestamp
        current_user.hashed_password = get_password_hash(user_update.new_password)
        current_user.password_set_at = datetime.now()
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/", response_model=List[UserInfo])
async def list_users(
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""
    users = db.query(User).all()
    return users

@router.get("/{user_id}", response_model=UserInfo)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """Get user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}/role", response_model=UserInfo)
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """Update user role (super_admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing own role
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )
    
    # Prevent demoting the last super_admin
    if user.role == "super_admin" and role_update.role != "super_admin":
        super_admin_count = db.query(User).filter(User.role == "super_admin").count()
        if super_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last super_admin"
            )
    
    user.role = role_update.role
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/quota", response_model=UserInfo)
async def update_user_quota(
    user_id: int,
    quota_update: UserQuotaUpdate,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """Update user storage quota (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.storage_quota_gb = quota_update.storage_quota_gb
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/rate-limit", response_model=UserInfo)
async def update_user_rate_limit(
    user_id: int,
    rate_limit_update: UserRateLimitUpdate,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """Update user custom rate limit (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.custom_rate_limit = rate_limit_update.custom_rate_limit
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """Delete user (super_admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    # Prevent deleting the last super_admin
    if user.role == "super_admin":
        super_admin_count = db.query(User).filter(User.role == "super_admin").count()
        if super_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last super_admin"
            )
    
    # Delete user (cascade will delete files)
    db.delete(user)
    db.commit()
    
    return {"status": "success", "message": "User deleted"}


# === User Approval Management ===

@router.get("/pending", response_model=List[UserInfo])
async def get_pending_users(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """승인 대기 중인 사용자 목록 조회 (super_admin만 접근 가능)"""
    pending_users = db.query(User).filter(
        User.is_active == 0
    ).order_by(User.created_at.desc()).all()
    
    return pending_users


@router.get("/pending/count")
async def get_pending_users_count(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """승인 대기 중인 사용자 수 조회 (super_admin만 접근 가능)"""
    count = db.query(User).filter(User.is_active == 0).count()
    
    return {"count": count}


@router.post("/{user_id}/approve")
async def approve_user(
    user_id: int,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """사용자 승인 (super_admin만 접근 가능)"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_active == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already active"
        )
    
    user.is_active = 1
    db.commit()
    
    return {"message": f"User {user.username} approved successfully"}


@router.delete("/{user_id}/reject")
async def reject_user(
    user_id: int,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """사용자 거부 및 삭제 (super_admin만 접근 가능)"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_active == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject active user"
        )
    
    username = user.username
    db.delete(user)
    db.commit()
    
    return {"message": f"User {username} rejected and deleted"}


# === Admin User Management ===

@router.get("/admin/users", response_model=List[dict])
async def get_all_users(
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)"""
    from ..database import RolePermissions
    users = db.query(User).all()
    result = []
    
    for user in users:
        from ..permissions import get_user_permissions
        
        # Get role default permissions
        role_perms = db.query(RolePermissions).filter(
            RolePermissions.role == user.role
        ).first()
        
        role_defaults = {}
        if role_perms:
            role_defaults = {
                "can_download_to_nas": role_perms.can_download_to_nas,
                "can_download_from_nas": role_perms.can_download_from_nas,
                "can_create_share_links": role_perms.can_create_share_links,
                "can_view_public_board": role_perms.can_view_public_board,
                "can_post_to_public_board": role_perms.can_post_to_public_board,
                "can_use_telegram_bot": role_perms.can_use_telegram_bot
            }
        
        user_data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "is_active": bool(user.is_active),
            "storage_quota_gb": user.storage_quota_gb,
            "custom_rate_limit": user.custom_rate_limit,
            "created_at": user.created_at,
            "last_login": user.last_login,
            "permissions": get_user_permissions(user, db),  # Actual effective permissions
            "permission_values": {  # Raw values: 0=use_default, 1=allow, 2=deny
                "can_download_to_nas": user.can_download_to_nas,
                "can_download_from_nas": user.can_download_from_nas,
                "can_create_share_links": user.can_create_share_links,
                "can_view_public_board": user.can_view_public_board,
                "can_post_to_public_board": user.can_post_to_public_board,
                "can_use_telegram_bot": user.can_use_telegram_bot
            },
            "role_defaults": role_defaults  # Role default permissions for UI
        }
        result.append(user_data)
    
    return result


@router.put("/admin/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: int,
    permissions: dict,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Update user permissions (admin only)
    
    Permission values:
    - 0: Use role default (follows role_permissions)
    - 1: Explicitly allow (override role default)
    - 2: Explicitly deny (override role default)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update permissions (0=default, 1=allow, 2=deny)
    for permission_name, value in permissions.items():
        if hasattr(user, permission_name):
            # Validate value is 0, 1, or 2
            int_value = int(value)
            if int_value not in [0, 1, 2]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid permission value: {value}. Must be 0 (default), 1 (allow), or 2 (deny)"
                )
            setattr(user, permission_name, int_value)
    
    db.commit()
    
    return {"message": "Permissions updated successfully"}


@router.put("/admin/users/{user_id}/password")
async def admin_change_password(
    user_id: int,
    password_data: dict,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Change user password (admin only).
    
    Works for all users regardless of auth_provider:
    - Local users: Updates their password
    - SSO users: Sets/updates password to enable local authentication fallback
    
    Changing password does not affect SSO authentication or account linking.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_password = password_data.get("new_password")
    if not new_password:
        raise HTTPException(status_code=400, detail="new_password is required")
    
    # Update password - works for both local and SSO users
    # Does not affect SSO authentication or account linking
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Update user information (super_admin only).
    Super admin can update any user's display name and email without restrictions.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update email
    if user_update.email:
        # Check if email already exists (for other users)
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        user.email = user_update.email
    
    # Update display name (no cooldown for super_admin)
    if user_update.display_name is not None:
        new_display_name = user_update.display_name.strip()
        
        # Validate display name length
        if len(new_display_name) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Display name must be 20 characters or less"
            )
        
        # Check for duplicate display name or username conflict
        if new_display_name:
            # Check if another user has this as display_name
            existing_display = db.query(User).filter(
                User.display_name == new_display_name,
                User.id != user.id
            ).first()
            
            if existing_display:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="DISPLAY_NAME_TAKEN"
                )
            
            # Check if this matches any username
            existing_username = db.query(User).filter(
                User.username == new_display_name
            ).first()
            
            if existing_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="DISPLAY_NAME_CONFLICTS_USERNAME"
                )
        
        # Update display name and timestamp (no cooldown check for admin)
        user.display_name = new_display_name if new_display_name else None
        user.display_name_updated_at = datetime.now()
    
    db.commit()
    db.refresh(user)
    return user
