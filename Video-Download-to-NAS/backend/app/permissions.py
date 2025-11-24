"""
Permission management system
Handles role-based and user-specific permissions
"""

from sqlalchemy.orm import Session
from .database import User, SystemSetting, RolePermissions

# Permission values
PERMISSION_USE_ROLE_DEFAULT = 0
PERMISSION_ALLOWED = 1
PERMISSION_DENIED = 2

# Fallback role-based default permissions (used if database is not available)
FALLBACK_ROLE_PERMISSIONS = {
    'super_admin': {
        'can_download_to_nas': True,
        'can_download_from_nas': True,
        'can_create_share_links': True,
        'can_view_public_board': True,
        'can_post_to_public_board': True,
        'can_use_telegram_bot': True,
    },
    'admin': {
        'can_download_to_nas': True,
        'can_download_from_nas': True,
        'can_create_share_links': True,
        'can_view_public_board': True,
        'can_post_to_public_board': True,
        'can_use_telegram_bot': True,
    },
    'user': {
        'can_download_to_nas': True,
        'can_download_from_nas': False,  # PC 다운로드 제한 (트래픽 문제)
        'can_create_share_links': False,  # 공유 링크 생성 제한
        'can_view_public_board': True,
        'can_post_to_public_board': True,
        'can_use_telegram_bot': False,
    },
    'guest': {
        'can_download_to_nas': False,
        'can_download_from_nas': False,  # PC 다운로드 제한
        'can_create_share_links': False,
        'can_view_public_board': True,  # 게시판 조회만 가능
        'can_post_to_public_board': False,
        'can_use_telegram_bot': False,
    }
}


def check_permission(user: User, permission_name: str, db: Session = None) -> bool:
    """
    Check if user has a specific permission.
    
    Permission resolution order:
    1. Super admin always has all permissions
    2. If user has explicit permission (1 or 2), use that
    3. Otherwise, use role-based default from database
    4. If database not available, use fallback defaults
    
    Args:
        user: User object
        permission_name: Name of permission (e.g., 'can_download_to_nas')
        db: Database session (optional, for loading role permissions)
    
    Returns:
        bool: True if user has permission, False otherwise
    """
    # Super admin always has all permissions
    if user.role == 'super_admin':
        return True
    
    # Get user's explicit permission value
    user_permission = getattr(user, permission_name, PERMISSION_USE_ROLE_DEFAULT)
    
    # If explicitly set, use that
    if user_permission == PERMISSION_ALLOWED:
        return True
    elif user_permission == PERMISSION_DENIED:
        return False
    
    # Otherwise, use role default from database
    if db:
        role_perms = db.query(RolePermissions).filter(
            RolePermissions.role == user.role
        ).first()
        
        if role_perms:
            perm_value = getattr(role_perms, permission_name, 0)
            return perm_value == 1
    
    # Fallback to hardcoded defaults
    role_defaults = FALLBACK_ROLE_PERMISSIONS.get(user.role, FALLBACK_ROLE_PERMISSIONS['guest'])
    return role_defaults.get(permission_name, False)


def get_user_permissions(user: User, db: Session = None) -> dict:
    """
    Get all permissions for a user.
    
    Returns:
        dict: Dictionary of permission names to boolean values
    """
    permissions = {}
    for permission_name in [
        'can_download_to_nas',
        'can_download_from_nas',
        'can_create_share_links',
        'can_view_public_board',
        'can_post_to_public_board',
        'can_use_telegram_bot'
    ]:
        permissions[permission_name] = check_permission(user, permission_name, db)
    
    return permissions


def update_role_permissions(db: Session, role: str, permissions: dict):
    """
    Update default permissions for a role.
    Stored in system_settings table.
    """
    for permission_name, value in permissions.items():
        key = f"role_permission_{role}_{permission_name}"
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        
        if setting:
            setting.value = str(value).lower()
        else:
            setting = SystemSetting(key=key, value=str(value).lower())
            db.add(setting)
    
    db.commit()


def get_role_permissions(db: Session, role: str) -> dict:
    """
    Get default permissions for a role from database.
    Falls back to hardcoded defaults if not in database.
    """
    # Try to get from database
    role_perms = db.query(RolePermissions).filter(
        RolePermissions.role == role
    ).first()
    
    if role_perms:
        return {
            'can_download_to_nas': role_perms.can_download_to_nas == 1,
            'can_download_from_nas': role_perms.can_download_from_nas == 1,
            'can_create_share_links': role_perms.can_create_share_links == 1,
            'can_view_public_board': role_perms.can_view_public_board == 1,
            'can_post_to_public_board': role_perms.can_post_to_public_board == 1,
            'can_use_telegram_bot': role_perms.can_use_telegram_bot == 1,
        }
    
    # Fallback to hardcoded defaults
    return FALLBACK_ROLE_PERMISSIONS.get(role, FALLBACK_ROLE_PERMISSIONS['guest']).copy()
