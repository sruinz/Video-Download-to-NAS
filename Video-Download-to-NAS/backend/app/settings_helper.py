from sqlalchemy.orm import Session
from .database import SystemSetting
import os

def get_setting(db: Session, key: str, default: str = None) -> str:
    """Get setting from database, fallback to env var, then default"""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        return setting.value
    return os.getenv(key.upper(), default)

def set_setting(db: Session, key: str, value: str):
    """Set or update setting in database"""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(key=key, value=value)
        db.add(setting)
    db.commit()
    return setting

def get_bool_setting(db: Session, key: str, default: bool = False) -> bool:
    """Get boolean setting"""
    value = get_setting(db, key, str(default).lower())
    return value.lower() in ('true', '1', 'yes', 'on')
