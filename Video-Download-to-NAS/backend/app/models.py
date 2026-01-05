from pydantic import BaseModel, field_serializer
from typing import Optional, Literal, List
from datetime import datetime, timezone

# Request Models
class UserLogin(BaseModel):
    id: str
    pw: str

class UserRegister(BaseModel):
    username: str
    email: Optional[str] = None
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class UserRoleUpdate(BaseModel):
    role: Literal["super_admin", "admin", "user", "guest"]
    
class UserQuotaUpdate(BaseModel):
    storage_quota_gb: int

class UserRateLimitUpdate(BaseModel):
    custom_rate_limit: Optional[int] = None  # null = use role default

class DownloadRequest(BaseModel):
    url: str
    resolution: str = "best"
    id: Optional[str] = None  # Username (for password auth)
    pw: Optional[str] = None  # Password (for password auth)
    token: Optional[str] = None  # API token (for token auth)

class ShareCreate(BaseModel):
    file_id: int
    expires_in_hours: Optional[int] = 24
    password: Optional[str] = None

class LibraryQuery(BaseModel):
    page: int = 1
    page_size: int = 20
    search: Optional[str] = None
    file_type: Optional[Literal["video", "audio", "subtitle"]] = None
    sort_by: Literal["created_at", "filename", "file_size"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"

class FileRenameRequest(BaseModel):
    new_filename: str

class APITokenCreate(BaseModel):
    name: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "My Chrome Extension"
            }
        }

class APITokenUpdate(BaseModel):
    name: Optional[str] = None

# Response Models
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class FileInfo(BaseModel):
    id: int
    filename: str
    original_url: str
    file_type: Literal["video", "audio", "subtitle"]
    file_size: Optional[int] = None
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    
    # Video metadata fields
    resolution: Optional[str] = None
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    bitrate: Optional[str] = None
    framerate: Optional[str] = None
    
    is_public: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True

class DownloadStatus(BaseModel):
    id: str
    status: Literal["pending", "downloading", "completed", "failed"]
    progress: float = 0.0
    filename: Optional[str] = None
    error: Optional[str] = None

class ShareLink(BaseModel):
    token: str
    url: str
    expires_at: datetime

class PaginatedResponse(BaseModel):
    items: List[FileInfo]
    total: int
    page: int
    page_size: int
    total_pages: int

class UserInfo(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str
    is_active: bool
    storage_quota_gb: int
    custom_rate_limit: Optional[int] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    permissions: Optional[dict] = None
    auth_provider: Optional[str] = "local"
    external_id: Optional[str] = None
    
    class Config:
        from_attributes = True

# SSO Settings Models
class SSOProviderSettingsUpdate(BaseModel):
    enabled: bool
    provider_type: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    scopes: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    discovery_url: Optional[str] = None
    display_name: Optional[str] = None
    icon_url: Optional[str] = None

class SSOProviderSettingsResponse(BaseModel):
    provider: str
    provider_type: str
    enabled: bool
    client_id: Optional[str] = None
    redirect_uri: Optional[str] = None
    scopes: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    discovery_url: Optional[str] = None
    display_name: Optional[str] = None
    icon_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class APITokenResponse(BaseModel):
    id: int
    name: str
    token_prefix: str
    created_at: datetime
    last_used_at: Optional[datetime]
    is_active: bool
    
    class Config:
        from_attributes = True

class APITokenCreateResponse(BaseModel):
    id: int
    name: str
    token: str
    token_prefix: str
    config_url: str  # 원클릭 설정 URL (server_url#token)
    created_at: datetime
    
    class Config:
        from_attributes = True

# Telegram Bot Models
class TelegramBotSetup(BaseModel):
    """텔레그램 봇 설정 요청"""
    bot_token: str
    bot_mode: Literal['button', 'best', 'mp3'] = 'best'
    notifications_enabled: bool = True
    progress_notifications: bool = False
    
    class Config:
        json_schema_extra = {
            "example": {
                "bot_token": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
                "bot_mode": "best",
                "notifications_enabled": True,
                "progress_notifications": False
            }
        }

class TelegramBotUpdate(BaseModel):
    """텔레그램 봇 설정 업데이트"""
    bot_mode: Optional[Literal['button', 'best', 'mp3']] = None
    notifications_enabled: Optional[bool] = None
    progress_notifications: Optional[bool] = None

class TelegramBotStatus(BaseModel):
    """텔레그램 봇 상태 응답"""
    id: int
    bot_mode: str
    is_active: bool
    status: str  # 'running', 'stopped', 'error', 'starting'
    error_message: Optional[str] = None
    last_active_at: Optional[datetime] = None
    total_downloads: int
    total_messages: int
    notifications_enabled: bool
    progress_notifications: bool
    created_at: datetime
    
    @field_serializer('last_active_at', 'created_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        """Datetime을 ISO 8601 형식으로 직렬화 (UTC 명시)"""
        if dt is None:
            return None
        # naive datetime을 UTC로 간주하고 timezone 정보 추가
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    class Config:
        from_attributes = True

class TelegramBotInfo(BaseModel):
    """텔레그램 봇 정보 (관리자용)"""
    id: int
    user_id: int
    username: str
    bot_mode: str
    status: str
    last_active_at: Optional[datetime] = None
    total_downloads: int
    error_message: Optional[str] = None
    
    @field_serializer('last_active_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        """Datetime을 ISO 8601 형식으로 직렬화 (UTC 명시)"""
        if dt is None:
            return None
        # naive datetime을 UTC로 간주하고 timezone 정보 추가
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    class Config:
        from_attributes = True

class TelegramBotTestRequest(BaseModel):
    """텔레그램 봇 테스트 요청"""
    bot_token: str

class TelegramBotTestResponse(BaseModel):
    """텔레그램 봇 테스트 응답"""
    success: bool
    bot_username: Optional[str] = None
    bot_name: Optional[str] = None
    error: Optional[str] = None

# Folder Organization Models
class FolderOrganizationUpdate(BaseModel):
    """폴더 구성 모드 업데이트 요청"""
    mode: Literal[
        "root",              # 루트 폴더 (username/)
        "date",              # 날짜 폴더 (username/2024-12-04/)
        "site_full",         # 전체 도메인 (username/example.com/)
        "site_name",         # 도메인명 (username/example/)
        "date_site_full",    # 날짜 + 전체 도메인 (username/2024-12-04/example.com/)
        "date_site_name",    # 날짜 + 도메인명 (username/2024-12-04/example/)
        "site_full_date",    # 전체 도메인 + 날짜 (username/example.com/2024-12-04/)
        "site_name_date"     # 도메인명 + 날짜 (username/example/2024-12-04/)
    ]
    
    class Config:
        json_schema_extra = {
            "example": {
                "mode": "site_full_date"
            }
        }

class FolderOrganizationResponse(BaseModel):
    """폴더 구성 모드 응답"""
    mode: str
    
    class Config:
        from_attributes = True
