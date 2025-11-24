from sqlalchemy import create_engine, Column, Integer, String, DateTime, BigInteger, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import QueuePool
from datetime import datetime
import os
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/vdtn.db")

# Ensure data directory exists
if DATABASE_URL.startswith("sqlite"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    # Convert to absolute path if not already
    if not db_path.startswith("/"):
        db_path = os.path.abspath(db_path)
    db_dir = Path(db_path).parent
    db_dir.mkdir(parents=True, exist_ok=True)

# Create engine with optimized connection pool settings
# SQLite and other databases require different pool configurations
if DATABASE_URL.startswith("sqlite"):
    # SQLite: Use NullPool to create new connection for each request
    # This prevents "database is locked" errors with concurrent access
    from sqlalchemy.pool import NullPool
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,  # No pooling for SQLite
        echo_pool=False
    )
else:
    # PostgreSQL/MySQL: Use QueuePool with increased limits
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=30,
        pool_recycle=3600,
        pool_pre_ping=True,
        echo_pool=False
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False, index=True)  # super_admin, admin, user, guest
    is_active = Column(Integer, default=1, nullable=False)  # SQLite doesn't have boolean
    storage_quota_gb = Column(Integer, default=10, nullable=False)
    custom_rate_limit = Column(Integer, nullable=True)  # Override role-based limit, null = use role default
    
    # SSO Authentication fields
    auth_provider = Column(String, default="local", nullable=False, index=True)  # 'local', 'google', 'microsoft', 'github', 'synology', 'authentik', 'generic_oidc'
    external_id = Column(String, nullable=True, index=True)  # OAuth2 provider's user ID
    email_verified = Column(Integer, default=0, nullable=False)  # 0 = not verified, 1 = verified
    display_name = Column(String, nullable=True)  # Display name for privacy (especially for SSO users with email as username)
    display_name_updated_at = Column(DateTime, nullable=True)  # Last time display name was changed
    password_set_at = Column(DateTime, nullable=True)  # When user manually set their password (null = never set, using random/initial password)
    
    # Permissions (0 = use role default, 1 = allowed, 2 = denied)
    can_download_to_nas = Column(Integer, default=0, nullable=False)  # Download videos to NAS
    can_download_from_nas = Column(Integer, default=0, nullable=False)  # Download files from NAS to PC
    can_create_share_links = Column(Integer, default=0, nullable=False)  # Create share links
    can_view_public_board = Column(Integer, default=0, nullable=False)  # View public board
    can_post_to_public_board = Column(Integer, default=0, nullable=False)  # Post to public board
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Telegram Bot permission
    can_use_telegram_bot = Column(Integer, default=0, nullable=False)  # 0 = use role default, 1 = allowed, 2 = denied
    
    # Relationships
    files = relationship("DownloadedFile", back_populates="user", cascade="all, delete-orphan")
    share_tokens = relationship("ShareToken", back_populates="user", cascade="all, delete-orphan")
    api_tokens = relationship("APIToken", back_populates="user", cascade="all, delete-orphan")
    telegram_bot = relationship("TelegramBot", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Composite index for SSO lookups and performance optimization
    __table_args__ = (
        Index('idx_auth_provider_external_id', 'auth_provider', 'external_id'),
        Index('idx_is_active', 'is_active'),
    )

class DownloadedFile(Base):
    __tablename__ = "downloaded_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, nullable=False)
    original_url = Column(String, nullable=False)
    file_type = Column(String, index=True, nullable=False)  # video, audio, subtitle
    file_size = Column(BigInteger, nullable=True)
    thumbnail = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)  # in seconds
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    
    # Public board settings
    is_public = Column(Integer, default=0, nullable=False, index=True)  # 0 = private, 1 = public
    public_title = Column(String, nullable=True)  # Custom title for public board
    public_description = Column(String, nullable=True)  # Description for public board
    
    # Relationships
    user = relationship("User", back_populates="files")
    share_tokens = relationship("ShareToken", back_populates="file", cascade="all, delete-orphan")
    share_tokens = relationship("ShareToken", back_populates="file", cascade="all, delete-orphan")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_user_created', 'user_id', 'created_at'),
        Index('idx_user_type', 'user_id', 'file_type'),
    )

class ShareToken(Base):
    __tablename__ = "share_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    file_id = Column(Integer, ForeignKey("downloaded_files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Share settings
    title = Column(String, nullable=True)  # Custom title for share
    password_hash = Column(String, nullable=True)  # Optional password protection
    expires_at = Column(DateTime, nullable=True, index=True)  # Optional expiration
    max_views = Column(Integer, nullable=True)  # Optional max view count (0 = unlimited)
    view_count = Column(Integer, default=0, nullable=False)  # Current view count
    allow_download = Column(Integer, default=0, nullable=False)  # 0=no, 1=yes
    allow_anonymous = Column(Integer, default=0, nullable=False)  # 0=no, 1=yes (비회원 접근)
    is_active = Column(Integer, default=1, nullable=False)  # 0=disabled, 1=active
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    last_accessed_at = Column(DateTime, nullable=True)
    
    # Relationships
    file = relationship("DownloadedFile", back_populates="share_tokens")
    user = relationship("User", back_populates="share_tokens")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

class SSOSettings(Base):
    __tablename__ = "sso_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, unique=True, index=True, nullable=False)  # 'google', 'microsoft', 'github', 'synology', 'authentik', 'generic_oidc'
    provider_type = Column(String, nullable=False, default='oauth2')  # 'oauth2' or 'oidc'
    enabled = Column(Integer, default=0, nullable=False)  # 0=disabled, 1=enabled
    
    # OAuth2/OIDC basic settings
    client_id = Column(String, nullable=True)
    client_secret_encrypted = Column(String, nullable=True)  # Encrypted Client Secret
    redirect_uri = Column(String, nullable=True)
    scopes = Column(String, nullable=True)  # Comma-separated scopes
    
    # Custom endpoints (for Synology, Authentik, Generic OIDC)
    authorization_url = Column(String, nullable=True)
    token_url = Column(String, nullable=True)
    userinfo_url = Column(String, nullable=True)
    discovery_url = Column(String, nullable=True)  # OIDC Discovery endpoint
    
    # Additional settings
    display_name = Column(String, nullable=True)  # Display name in UI
    icon_url = Column(String, nullable=True)  # Custom icon URL
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

class SSOState(Base):
    __tablename__ = "sso_states"
    
    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, unique=True, index=True, nullable=False)
    provider = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Only for account linking
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # Expires after 10 minutes

class APIToken(Base):
    __tablename__ = "api_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # "My Chrome Extension"
    token_hash = Column(String(255), nullable=False, unique=True, index=True)  # bcrypt hash
    token_prefix = Column(String(20), nullable=False)  # "vdtn_abc...xyz" for display
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1, nullable=False)  # 0 = revoked, 1 = active
    
    # Relationships
    user = relationship("User", back_populates="api_tokens")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_user_active', 'user_id', 'is_active'),
    )

class TelegramBot(Base):
    __tablename__ = "telegram_bots"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    bot_token_encrypted = Column(String, unique=True, nullable=False)  # Encrypted bot token
    bot_mode = Column(String, default='best', nullable=False)  # 'button', 'best', 'mp3'
    is_active = Column(Integer, default=1, nullable=False)  # 0 = inactive, 1 = active
    api_token_id = Column(Integer, ForeignKey("api_tokens.id", ondelete="SET NULL"), nullable=True)
    api_token_encrypted = Column(String, nullable=True)  # Encrypted API token for download requests
    chat_id = Column(BigInteger, nullable=True)  # Telegram chat ID for sending notifications
    
    # 상태 추적
    status = Column(String, default='stopped', nullable=False)  # 'running', 'stopped', 'error', 'starting'
    error_message = Column(String, nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    
    # 통계
    total_downloads = Column(Integer, default=0, nullable=False)
    total_messages = Column(Integer, default=0, nullable=False)
    
    # 알림 설정
    notifications_enabled = Column(Integer, default=1, nullable=False)  # 0 = disabled, 1 = enabled
    progress_notifications = Column(Integer, default=0, nullable=False)  # 0 = disabled, 1 = enabled
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="telegram_bot")
    api_token = relationship("APIToken")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_telegram_bots_status', 'status'),
        Index('idx_telegram_bots_is_active', 'is_active'),
    )


class RolePermissions(Base):
    __tablename__ = "role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, unique=True, nullable=False, index=True)  # 'super_admin', 'admin', 'user', 'guest'
    
    # Default permissions for this role (1 = allowed, 0 = denied)
    can_download_to_nas = Column(Integer, default=1, nullable=False)
    can_download_from_nas = Column(Integer, default=1, nullable=False)
    can_create_share_links = Column(Integer, default=1, nullable=False)
    can_view_public_board = Column(Integer, default=1, nullable=False)
    can_post_to_public_board = Column(Integer, default=0, nullable=False)
    can_use_telegram_bot = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)


def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Initialize default settings
    db = SessionLocal()
    try:
        default_settings = {
            # Registration settings
            'allow_registration': 'true',
            'default_user_role': 'user',
            'require_email_verification': 'false',
            'require_admin_approval': 'false',
            # Login settings
            'local_login_enabled': 'true',
            # Quota settings
            'default_user_quota_gb': '1',
            'admin_quota_gb': '10',
            # Rate limit by role (0 = unlimited)
            'rate_limit_super_admin': '0',
            'rate_limit_admin': '120',
            'rate_limit_user': '60',
            'rate_limit_guest': '30',
        }
        
        for key, value in default_settings.items():
            existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if not existing:
                setting = SystemSetting(key=key, value=value)
                db.add(setting)
        
        db.commit()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
