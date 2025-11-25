from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from ..database import User, get_db
from ..auth import require_role

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SystemSettings(BaseModel):
    allow_registration: bool
    local_login_enabled: bool
    require_admin_approval: bool
    default_user_role: str
    default_user_quota_gb: int
    admin_quota_gb: int
    display_name_change_cooldown_days: int
    rate_limit_super_admin: int
    rate_limit_admin: int
    rate_limit_user: int
    rate_limit_guest: int

class SettingsUpdate(BaseModel):
    allow_registration: Optional[bool] = None
    local_login_enabled: Optional[bool] = None
    require_admin_approval: Optional[bool] = None
    default_user_role: Optional[str] = None
    default_user_quota_gb: Optional[int] = None
    admin_quota_gb: Optional[int] = None
    display_name_change_cooldown_days: Optional[int] = None
    rate_limit_super_admin: Optional[int] = None
    rate_limit_admin: Optional[int] = None
    rate_limit_user: Optional[int] = None
    rate_limit_guest: Optional[int] = None

class SystemStats(BaseModel):
    total_users: int
    total_files: int
    total_storage_used_gb: float
    active_downloads: int

@router.get("/public")
async def get_public_settings(db: Session = Depends(get_db)):
    """Get public settings (no authentication required)"""
    from ..settings_helper import get_bool_setting
    
    return {
        "allow_registration": get_bool_setting(db, "allow_registration", True),
        "local_login_enabled": get_bool_setting(db, "local_login_enabled", True)
    }

@router.get("/public/cooldown")
async def get_public_cooldown(db: Session = Depends(get_db)):
    """Get display name change cooldown setting (no authentication required)"""
    from ..settings_helper import get_setting
    
    return {
        "display_name_change_cooldown_days": int(get_setting(db, "display_name_change_cooldown_days", "30"))
    }

@router.get("/", response_model=SystemSettings)
async def get_settings(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """Get system settings (super_admin only)"""
    from ..settings_helper import get_bool_setting, get_setting
    
    return SystemSettings(
        allow_registration=get_bool_setting(db, "allow_registration", True),
        local_login_enabled=get_bool_setting(db, "local_login_enabled", True),
        require_admin_approval=get_bool_setting(db, "require_admin_approval", False),
        default_user_role=get_setting(db, "default_user_role", "user"),
        default_user_quota_gb=int(get_setting(db, "default_user_quota_gb", "1")),
        admin_quota_gb=int(get_setting(db, "admin_quota_gb", "10")),
        display_name_change_cooldown_days=int(get_setting(db, "display_name_change_cooldown_days", "30")),
        rate_limit_super_admin=int(get_setting(db, "rate_limit_super_admin", "0")),
        rate_limit_admin=int(get_setting(db, "rate_limit_admin", "120")),
        rate_limit_user=int(get_setting(db, "rate_limit_user", "60")),
        rate_limit_guest=int(get_setting(db, "rate_limit_guest", "30"))
    )

@router.put("/", response_model=SystemSettings)
async def update_settings(
    settings_update: SettingsUpdate,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """Update system settings (super_admin only)"""
    from ..settings_helper import set_setting
    
    if settings_update.allow_registration is not None:
        set_setting(db, "allow_registration", str(settings_update.allow_registration).lower())
    
    if settings_update.local_login_enabled is not None:
        set_setting(db, "local_login_enabled", str(settings_update.local_login_enabled).lower())
    
    if settings_update.require_admin_approval is not None:
        set_setting(db, "require_admin_approval", str(settings_update.require_admin_approval).lower())
    
    if settings_update.default_user_role is not None:
        set_setting(db, "default_user_role", settings_update.default_user_role)
    
    if settings_update.default_user_quota_gb is not None:
        set_setting(db, "default_user_quota_gb", str(settings_update.default_user_quota_gb))
    
    if settings_update.admin_quota_gb is not None:
        set_setting(db, "admin_quota_gb", str(settings_update.admin_quota_gb))
    
    if settings_update.display_name_change_cooldown_days is not None:
        set_setting(db, "display_name_change_cooldown_days", str(settings_update.display_name_change_cooldown_days))
    
    if settings_update.rate_limit_super_admin is not None:
        set_setting(db, "rate_limit_super_admin", str(settings_update.rate_limit_super_admin))
    
    if settings_update.rate_limit_admin is not None:
        set_setting(db, "rate_limit_admin", str(settings_update.rate_limit_admin))
    
    if settings_update.rate_limit_user is not None:
        set_setting(db, "rate_limit_user", str(settings_update.rate_limit_user))
    
    if settings_update.rate_limit_guest is not None:
        set_setting(db, "rate_limit_guest", str(settings_update.rate_limit_guest))
    
    # Return updated settings
    return await get_settings(current_user, db)

@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    current_user: User = Depends(require_role(["super_admin", "admin"]))
):
    """Get system statistics (admin only)"""
    from ..database import get_db, DownloadedFile
    from sqlalchemy.orm import Session
    from pathlib import Path
    
    db = next(get_db())
    
    try:
        total_users = db.query(User).count()
        total_files = db.query(DownloadedFile).count()
        
        # Calculate storage used
        downloads_dir = Path("/app/downloads")
        total_size = 0
        if downloads_dir.exists():
            for file_path in downloads_dir.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        
        total_storage_gb = total_size / (1024 ** 3)
        
        # Active downloads (from memory)
        from ..downloader import download_status
        active_downloads = sum(1 for status in download_status.values() 
                             if status['status'] in ['pending', 'downloading'])
        
        return SystemStats(
            total_users=total_users,
            total_files=total_files,
            total_storage_used_gb=round(total_storage_gb, 2),
            active_downloads=active_downloads
        )
    finally:
        db.close()
