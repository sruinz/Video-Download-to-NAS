from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import Optional
import uuid
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

from .models import UserLogin, DownloadRequest, FileInfo, Token, DownloadStatus
from .database import init_db, get_db, User, DownloadedFile, SessionLocal, engine, SystemSetting
from .auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    init_default_user,
    verify_token
)
from .downloader import download_video, get_download_status
from .routers import users, settings, share_links, public_board, sso, sso_admin, api_tokens, telegram_bot, role_permissions, version
from .websocket_manager import manager as ws_manager
from .library_sync import sync_user_library, sync_all_libraries

# Rate limiter setup (will be configured from DB after startup)
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app = FastAPI(title="Video Download to NAS API", version="1.1.5")  # Updated by update_version.sh during build
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(share_links.router)
app.include_router(public_board.router)
app.include_router(sso.router)
app.include_router(sso_admin.router)
app.include_router(api_tokens.router)
app.include_router(telegram_bot.router)
app.include_router(role_permissions.router)
app.include_router(version.router)


# === Thumbnail Endpoint ===

@app.get("/api/thumbnail/{file_id}")
@limiter.exempt
async def get_thumbnail(
    file_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get thumbnail for a file"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Verify token if provided
    current_user = None
    if token:
        try:
            from .auth import verify_token
            current_user = verify_token(token, db)
        except:
            pass
    
    # Get file info
    query = db.query(DownloadedFile).filter(DownloadedFile.id == file_id)
    if current_user:
        query = query.filter(DownloadedFile.user_id == current_user.id)
    
    file_info = query.first()
    
    if not file_info:
        logger.error(f"File {file_id} not found")
        raise HTTPException(status_code=404, detail="File not found")
    
    if not file_info.thumbnail:
        logger.error(f"File {file_id} has no thumbnail in DB")
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    logger.info(f"File {file_id} thumbnail: {file_info.thumbnail}")
    
    # If thumbnail is a URL (external), redirect to it
    if file_info.thumbnail.startswith('http'):
        logger.info(f"Redirecting to external thumbnail: {file_info.thumbnail}")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=file_info.thumbnail)
    
    # Otherwise, serve local thumbnail file
    thumbnail_path = Path("/app/downloads") / file_info.thumbnail
    logger.info(f"Serving local thumbnail: {thumbnail_path}")
    
    if not thumbnail_path.exists():
        logger.error(f"Thumbnail file not found: {thumbnail_path}")
        raise HTTPException(status_code=404, detail=f"Thumbnail file not found: {thumbnail_path}")
    
    # Determine media type based on extension
    ext = thumbnail_path.suffix.lower()
    media_type = 'image/jpeg'
    if ext == '.webp':
        media_type = 'image/webp'
    elif ext == '.png':
        media_type = 'image/png'
    
    return FileResponse(
        path=thumbnail_path,
        media_type=media_type
    )


# === Library Sync Endpoints ===

@app.post("/api/admin/sync-library")
async def sync_library(
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sync library by scanning download folders (super_admin only)"""
    if current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="Only super_admin can sync library")
    
    try:
        if user_id:
            # Sync specific user
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            result = await sync_user_library(db, user.id, user.username)
        else:
            # Sync all users
            result = await sync_all_libraries(db)
        
        return {
            "status": "success",
            "results": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# CORS middleware - configurable via environment variable
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins == "*":
    origins_list = ["*"]
else:
    origins_list = [origin.strip() for origin in allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    from .settings_helper import get_setting
    from .migrations import migrate_sso_schema, init_sso_settings, migrate_api_tokens_schema, migrate_telegram_bots_schema, migrate_role_permissions_schema, migrate_user_approval_schema
    from .sso.scheduler import start_scheduler
    from .telegram.bot_manager import bot_manager
    
    # Display legal notice
    print("=" * 70)
    print("⚠️  Video Download to NAS - Legal Notice")
    print("=" * 70)
    print("")
    print("This software is a TOOL for personal media archiving.")
    print("")
    print("✅ Legitimate uses:")
    print("   - Backing up your own content")
    print("   - Creative Commons licensed content")
    print("   - Public domain materials")
    print("   - Educational Fair Use")
    print("")
    print("❌ You are responsible for:")
    print("   - Copyright law compliance")
    print("   - Respecting platform Terms of Service")
    print("   - Using only for legal purposes")
    print("")
    print("The developer is NOT responsible for user actions.")
    print("By using this software, you accept full responsibility.")
    print("")
    print("=" * 70)
    print("")
    
    init_db()
    db = next(get_db())
    
    # Run SSO schema migration
    try:
        migrate_sso_schema(db)
        init_sso_settings(db)
        print("✅ SSO schema migration completed")
    except Exception as e:
        logger.error(f"SSO migration error: {e}")
        print(f"⚠️  SSO migration warning: {e}")
    
    # Run API tokens schema migration
    try:
        migrate_api_tokens_schema(db)
        print("✅ API tokens schema migration completed")
    except Exception as e:
        logger.error(f"API tokens migration error: {e}")
        print(f"⚠️  API tokens migration warning: {e}")
    
    # Run Telegram bots schema migration
    try:
        migrate_telegram_bots_schema(db)
        print("✅ Telegram bots schema migration completed")
    except Exception as e:
        logger.error(f"Telegram bots migration error: {e}")
        print(f"⚠️  Telegram bots migration warning: {e}")
    
    # Run role permissions schema migration
    try:
        migrate_role_permissions_schema(db)
        print("✅ Role permissions schema migration completed")
    except Exception as e:
        logger.error(f"Role permissions migration error: {e}")
        print(f"⚠️  Role permissions migration warning: {e}")
    
    # Run user approval schema migration
    try:
        migrate_user_approval_schema(db)
        print("✅ User approval schema migration completed")
    except Exception as e:
        logger.error(f"User approval migration error: {e}")
        print(f"⚠️  User approval migration warning: {e}")
    
    # Start SSO state cleanup scheduler
    try:
        start_scheduler()
        print("✅ SSO state cleanup scheduler started")
    except Exception as e:
        logger.error(f"Failed to start SSO scheduler: {e}")
        print(f"⚠️  SSO scheduler warning: {e}")
    
    # Start Telegram bots
    telegram_bot_enabled = os.getenv("TELEGRAM_BOT_ENABLED", "false").lower() == "true"
    telegram_bot_auto_start = os.getenv("TELEGRAM_BOT_AUTO_START", "false").lower() == "true"
    
    if telegram_bot_enabled and telegram_bot_auto_start:
        try:
            await bot_manager.start_all_bots(db)
            print("✅ Telegram bots started")
        except Exception as e:
            logger.error(f"Failed to start Telegram bots: {e}")
            print(f"⚠️  Telegram bots startup warning: {e}")
    
    # Update rate limiter from DB settings
    rate_limit = get_setting(db, 'rate_limit_per_minute', '60')
    limiter._default_limits = [f"{rate_limit}/minute"]
    
    db.close()
    print("✅ Database initialized")
    print("✅ Server ready")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    from .sso.scheduler import stop_scheduler
    from .telegram.bot_manager import bot_manager
    
    try:
        stop_scheduler()
        print("✅ SSO state cleanup scheduler stopped")
    except Exception as e:
        logger.error(f"Failed to stop SSO scheduler: {e}")
    
    try:
        await bot_manager.stop_all_bots()
        print("✅ Telegram bots stopped")
    except Exception as e:
        logger.error(f"Failed to stop Telegram bots: {e}")

@app.get("/")
async def root():
    return {
        "message": "Video Download to NAS API",
        "version": "1.1.5",
        "status": "running",
        "legal_notice": "This software is a tool for legitimate media archiving. Users are responsible for compliance with copyright laws and platform terms of service.",
        "documentation": {
            "terms": "/api/legal/terms",
            "privacy": "/api/legal/privacy",
            "license": "/api/legal/license"
        }
    }

# === Legal Document Endpoints ===

@app.get("/api/legal/terms")
async def get_terms_of_service():
    """Get Terms of Service"""
    try:
        terms_path = Path("/app/TERMS_OF_SERVICE.md")
        if terms_path.exists():
            with open(terms_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content, "format": "markdown"}
        else:
            return {
                "content": "Terms of Service document not available. Please refer to the project repository.",
                "format": "text"
            }
    except Exception as e:
        logger.error(f"Error reading terms of service: {e}")
        return {"content": "Error loading terms of service", "format": "text"}

@app.get("/api/legal/privacy")
async def get_privacy_policy():
    """Get Privacy Policy"""
    try:
        privacy_path = Path("/app/PRIVACY_POLICY.md")
        if privacy_path.exists():
            with open(privacy_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content, "format": "markdown"}
        else:
            return {
                "content": "Privacy Policy document not available. Please refer to the project repository.",
                "format": "text"
            }
    except Exception as e:
        logger.error(f"Error reading privacy policy: {e}")
        return {"content": "Error loading privacy policy", "format": "text"}

@app.get("/api/legal/license")
async def get_license():
    """Get License information"""
    try:
        license_path = Path("/app/LICENSE")
        if license_path.exists():
            with open(license_path, "r", encoding="utf-8") as f:
                content = f.read()
            return {"content": content, "format": "text"}
        else:
            return {
                "content": "License document not available. Please refer to the project repository.",
                "format": "text"
            }
    except Exception as e:
        logger.error(f"Error reading license: {e}")
        return {"content": "Error loading license", "format": "text"}

# === Authentication Endpoints ===

@app.post("/api/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, user_login: UserLogin, db: Session = Depends(get_db)):
    """Login endpoint with rate limiting"""
    # Check if local login is enabled
    local_login_setting = db.query(SystemSetting).filter(
        SystemSetting.key == 'local_login_enabled'
    ).first()
    local_login_enabled = local_login_setting.value.lower() == 'true' if local_login_setting else True
    
    user = authenticate_user(db, user_login.id, user_login.pw)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # If local login is disabled, only allow super_admin
    if not local_login_enabled and user.role != 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local login is disabled. Only super admin can login locally."
        )

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# === Extension Compatible Endpoint ===

@app.post("/rest")
@limiter.limit("10/minute")
async def rest_download(
    request: Request,
    body: DownloadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Extension-compatible endpoint
    Supports both token and username/password authentication
    
    Authentication priority:
    1. Authorization header (Bearer token)
    2. body.token field
    3. body.id + body.pw (username/password)
    """
    from .auth import authenticate_with_token
    
    user = None
    auth_method = None
    
    # 1. Check Authorization header (Bearer token)
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.replace('Bearer ', '').strip()
        user = authenticate_with_token(db, token)
        if user:
            auth_method = "token (header)"
            logger.info(f"REST API: Token authentication (header) successful for user {user.username}")
    
    # 2. Check body.token field
    if not user and body.token:
        user = authenticate_with_token(db, body.token)
        if user:
            auth_method = "token (body)"
            logger.info(f"REST API: Token authentication (body) successful for user {user.username}")
    
    # 3. Fallback to username/password
    if not user and body.id and body.pw:
        user = authenticate_user(db, body.id, body.pw)
        if user:
            auth_method = "password"
            logger.info(f"REST API: Password authentication successful for user {user.username}")
    
    # 4. Authentication failed
    if not user:
        logger.warning(f"REST API: Authentication failed - no valid credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or token"
        )
    
    logger.info(f"REST API authentication successful: user={user.username}, user_id={user.id}, method={auth_method}")

    # Generate download ID
    download_id = str(uuid.uuid4())

    # Start download in background
    background_tasks.add_task(
        download_video,
        body.url,
        body.resolution,
        download_id,
        db,
        user.id,
        ws_manager
    )
    
    logger.info(f"REST API download started: download_id={download_id}, user={user.username}")

    return {
        "status": "success",
        "message": "Download started",
        "download_id": download_id
    }

# === Download Management Endpoints ===

@app.post("/api/download", response_model=dict)
@limiter.limit("10/minute")
async def start_download(
    request: Request,
    body: DownloadRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a new download (requires authentication token)"""
    download_id = str(uuid.uuid4())

    background_tasks.add_task(
        download_video,
        body.url,
        body.resolution,
        download_id,
        db,
        current_user.id,
        ws_manager
    )

    return {
        "status": "success",
        "message": "Download started",
        "download_id": download_id
    }

@app.get("/api/download/status/{download_id}", response_model=DownloadStatus)
async def check_download_status(
    download_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check download progress"""
    status = get_download_status(download_id)
    if not status:
        raise HTTPException(status_code=404, detail="Download not found")

    return {
        "id": download_id,
        **status
    }

# === Library Management Endpoints ===

@app.get("/api/library", response_model=list[FileInfo])
async def get_library(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all downloaded files for current user (legacy endpoint)"""
    files = db.query(DownloadedFile)\
        .filter(DownloadedFile.user_id == current_user.id)\
        .order_by(DownloadedFile.created_at.desc())\
        .all()

    return files

@app.get("/api/library/search")
async def search_library(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search and filter library with pagination"""
    from sqlalchemy import or_, desc, asc
    
    # Base query
    query = db.query(DownloadedFile).filter(DownloadedFile.user_id == current_user.id)
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                DownloadedFile.filename.ilike(search_pattern),
                DownloadedFile.original_url.ilike(search_pattern)
            )
        )
    
    # Apply file type filter
    if file_type:
        query = query.filter(DownloadedFile.file_type == file_type)
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(DownloadedFile, sort_by, DownloadedFile.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    # Apply pagination
    offset = (page - 1) * page_size
    files = query.offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": files,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@app.get("/api/file/{file_id}")
async def get_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a file"""
    file_info = db.query(DownloadedFile)\
        .filter(DownloadedFile.id == file_id)\
        .filter(DownloadedFile.user_id == current_user.id)\
        .first()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # file_info.filename is now relative path: username/filename.ext
    file_path = Path("/app/downloads") / file_info.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Return only the actual filename, not the path
    actual_filename = Path(file_info.filename).name
    return FileResponse(
        path=file_path,
        filename=actual_filename,
        media_type='application/octet-stream'
    )

@app.delete("/api/file/{file_id}")
async def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a file"""
    file_info = db.query(DownloadedFile)\
        .filter(DownloadedFile.id == file_id)\
        .filter(DownloadedFile.user_id == current_user.id)\
        .first()

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete from disk (file_info.filename is relative path: username/filename.ext)
    file_path = Path("/app/downloads") / file_info.filename
    if file_path.exists():
        file_path.unlink()
    
    # Delete thumbnail if exists
    if file_info.thumbnail:
        # Thumbnail is usually saved with same name but .webp or .jpg extension
        base_name = file_path.stem
        for ext in ['.webp', '.jpg', '.png']:
            thumb_path = file_path.parent / f"{base_name}{ext}"
            if thumb_path.exists():
                thumb_path.unlink()

    # Delete from database
    db.delete(file_info)
    db.commit()

    return {"status": "success", "message": "File deleted"}

# === File Sharing Endpoints ===

@app.post("/api/share")
async def create_share_link(
    file_id: int,
    expires_in_hours: int = 24,
    password: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a shareable link for a file"""
    from datetime import timedelta
    from .database import ShareToken
    from .auth import get_password_hash
    import secrets
    
    # Verify file ownership
    file_info = db.query(DownloadedFile)\
        .filter(DownloadedFile.id == file_id)\
        .filter(DownloadedFile.user_id == current_user.id)\
        .first()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Generate unique token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=expires_in_hours)
    
    # Hash password if provided
    password_hash = get_password_hash(password) if password else None
    
    # Create share token
    share_token = ShareToken(
        token=token,
        file_id=file_id,
        password_hash=password_hash,
        expires_at=expires_at
    )
    db.add(share_token)
    db.commit()
    
    return {
        "token": token,
        "url": f"/api/share/{token}",
        "expires_at": expires_at
    }

@app.get("/api/share/{token}")
async def get_shared_file(
    token: str,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Download a shared file"""
    from .database import ShareToken
    from .auth import verify_password
    
    # Find share token
    share = db.query(ShareToken).filter(ShareToken.token == token).first()
    
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check expiration
    if share.expires_at < datetime.now():
        raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Check password if required
    if share.password_hash:
        if not password or not verify_password(password, share.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    # Get file info
    file_info = db.query(DownloadedFile).filter(DownloadedFile.id == share.file_id).first()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = Path("/app/downloads") / file_info.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=file_info.filename,
        media_type='application/octet-stream'
    )

@app.delete("/api/share/{token}")
async def delete_share_link(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a share link"""
    from .database import ShareToken
    
    share = db.query(ShareToken)\
        .join(DownloadedFile)\
        .filter(ShareToken.token == token)\
        .filter(DownloadedFile.user_id == current_user.id)\
        .first()
    
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    db.delete(share)
    db.commit()
    
    return {"status": "success", "message": "Share link deleted"}

# === WebSocket Endpoint ===

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    WebSocket endpoint for real-time download updates.
    Uses short-lived DB connections for authentication only.
    Requires JWT token as query parameter: /ws?token=<jwt_token>
    """
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return
    
    # Acquire DB connection only for authentication
    db = SessionLocal()
    try:
        # Verify JWT token
        payload = verify_token(token)
        username = payload.get("sub")
        
        if not username:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Get user from database
        user = db.query(User).filter(User.username == username).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return
        
        user_id = user.id
        
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        # Log pool statistics for debugging (if available)
        try:
            if hasattr(engine.pool, 'status'):
                pool_status = engine.pool.status()
                logger.error(f"DB Pool status: {pool_status}")
        except Exception as pool_error:
            logger.debug(f"Pool status not available: {pool_error}")
        await websocket.close(code=1008, reason="Authentication failed")
        return
    finally:
        # CRITICAL: Release DB connection immediately after auth
        db.close()
    
    # Now proceed with WebSocket connection (no DB session held)
    await ws_manager.connect(websocket, user_id)
    
    try:
        # Keep connection alive with ping/pong
        while True:
            # Wait for messages from client (ping/pong)
            data = await websocket.receive_text()
            
            # Echo back for heartbeat
            if data == "ping":
                await websocket.send_text("pong")
    
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    
    finally:
        # Clean up connection
        ws_manager.disconnect(user_id)

# === Admin Monitoring Endpoints ===

@app.get("/api/admin/websocket/stats")
async def get_websocket_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get WebSocket connection statistics (admin only)"""
    if current_user.role not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    stats = ws_manager.get_stats()
    
    # Add database pool statistics (if available)
    try:
        pool_info = {
            "pool_class": engine.pool.__class__.__name__
        }
        
        # Only get detailed stats if pool supports it
        if hasattr(engine.pool, 'status'):
            pool_info.update({
                "status": engine.pool.status(),
                "size": engine.pool.size(),
                "checked_in": engine.pool.checkedin(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow(),
                "total_connections": engine.pool.checkedin() + engine.pool.checkedout()
            })
        else:
            pool_info["note"] = "Pool statistics not available for this pool type"
    except Exception as e:
        logger.error(f"Error getting pool stats: {e}")
        pool_info = {"error": str(e)}
    
    return {
        "websocket": stats,
        "database_pool": pool_info
    }

# === Health Check ===

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
