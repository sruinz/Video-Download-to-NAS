from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import hashlib

from ..database import get_db, User, DownloadedFile, ShareToken
from ..auth import get_current_user, get_password_hash, verify_password
from ..permissions import check_permission

router = APIRouter(prefix="/api/share-links", tags=["share-links"])


def generate_share_token():
    """Generate a unique share token"""
    return secrets.token_urlsafe(16)


@router.post("/create")
async def create_share_link(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a share link for a file"""
    # Check permission
    if not check_permission(current_user, 'can_create_share_links'):
        raise HTTPException(status_code=403, detail="No permission to create share links")
    
    file_id = data.get('file_id')
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id is required")
    
    # Get file and verify ownership
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id,
        DownloadedFile.user_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found or not owned by user")
    
    # Generate unique token
    token = generate_share_token()
    while db.query(ShareToken).filter(ShareToken.token == token).first():
        token = generate_share_token()
    
    # Parse settings
    title = data.get('title')
    password = data.get('password')
    expires_in_hours = data.get('expires_in_hours')  # None = no expiration
    max_views = data.get('max_views')  # None or 0 = unlimited
    allow_download = data.get('allow_download', False)
    allow_anonymous = data.get('allow_anonymous', False)
    
    # Validate download permission
    if allow_download and not current_user.can_download_from_nas:
        raise HTTPException(status_code=403, detail="No permission to allow downloads")
    
    # Calculate expiration
    expires_at = None
    if expires_in_hours:
        expires_at = datetime.now() + timedelta(hours=expires_in_hours)
    
    # Hash password if provided
    password_hash = None
    if password:
        password_hash = get_password_hash(password)
    
    # Create share token
    share_token = ShareToken(
        token=token,
        file_id=file_id,
        user_id=current_user.id,
        title=title,
        password_hash=password_hash,
        expires_at=expires_at,
        max_views=max_views if max_views else None,
        allow_download=1 if allow_download else 0,
        allow_anonymous=1 if allow_anonymous else 0
    )
    
    db.add(share_token)
    db.commit()
    db.refresh(share_token)
    
    return {
        "token": token,
        "url": f"/share/{token}",
        "expires_at": expires_at,
        "max_views": max_views,
        "allow_download": allow_download,
        "allow_anonymous": allow_anonymous
    }


@router.get("/my-links")
async def get_my_share_links(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all share links created by current user"""
    if not check_permission(current_user, 'can_create_share_links'):
        raise HTTPException(status_code=403, detail="No permission to view share links")
    
    links = db.query(ShareToken).filter(
        ShareToken.user_id == current_user.id
    ).order_by(ShareToken.created_at.desc()).all()
    
    result = []
    for link in links:
        # Check if expired
        is_expired = False
        if link.expires_at and link.expires_at < datetime.now():
            is_expired = True
        
        # Check if max views reached
        is_max_views_reached = False
        if link.max_views and link.view_count >= link.max_views:
            is_max_views_reached = True
        
        result.append({
            "id": link.id,
            "token": link.token,
            "url": f"/share/{link.token}",
            "title": link.title,
            "file": {
                "id": link.file.id,
                "filename": link.file.filename,
                "file_type": link.file.file_type,
                "thumbnail": link.file.thumbnail
            },
            "has_password": bool(link.password_hash),
            "expires_at": link.expires_at,
            "max_views": link.max_views,
            "view_count": link.view_count,
            "allow_download": bool(link.allow_download),
            "allow_anonymous": bool(link.allow_anonymous),
            "is_active": bool(link.is_active),
            "is_expired": is_expired,
            "is_max_views_reached": is_max_views_reached,
            "created_at": link.created_at,
            "last_accessed_at": link.last_accessed_at
        })
    
    return result


@router.put("/{link_id}/toggle")
async def toggle_share_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle share link active status"""
    link = db.query(ShareToken).filter(
        ShareToken.id == link_id,
        ShareToken.user_id == current_user.id
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    link.is_active = 0 if link.is_active else 1
    db.commit()
    
    return {"message": "Share link status updated", "is_active": bool(link.is_active)}


@router.delete("/{link_id}")
async def delete_share_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a share link"""
    link = db.query(ShareToken).filter(
        ShareToken.id == link_id,
        ShareToken.user_id == current_user.id
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    db.delete(link)
    db.commit()
    
    return {"message": "Share link deleted"}


async def get_current_user_optional(db: Session = Depends(get_db)):
    """Get current user if authenticated, otherwise return None"""
    from fastapi import Request
    from ..auth import verify_token
    
    try:
        # Try to get token from header
        from fastapi import Header
        authorization = Header(None)
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
            payload = verify_token(token)
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == int(user_id)).first()
                return user
    except:
        pass
    return None


@router.get("/access/{token}")
async def access_share_link(
    token: str,
    password: Optional[str] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Access a shared file via token"""
    # Try to get current user if authenticated
    current_user = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from ..auth import verify_token
            auth_token = authorization.split(" ")[1]
            payload = verify_token(auth_token)
            username = payload.get("sub")
            if username:
                current_user = db.query(User).filter(User.username == username).first()
        except Exception as e:
            print(f"[ShareLink Access] Auth error: {e}")
            pass
    
    link = db.query(ShareToken).filter(ShareToken.token == token).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check if active
    if not link.is_active:
        raise HTTPException(status_code=403, detail="Share link is disabled")
    
    # Check if expired
    if link.expires_at and link.expires_at < datetime.now():
        raise HTTPException(status_code=403, detail="Share link has expired")
    
    # Check max views
    if link.max_views and link.view_count >= link.max_views:
        raise HTTPException(status_code=403, detail="Share link has reached maximum views")
    
    # Check anonymous access - logged in users can always access
    if not current_user and not link.allow_anonymous:
        raise HTTPException(status_code=401, detail="Login required to access this link")
    
    # Check password (skip for file owner)
    is_owner = current_user and current_user.id == link.user_id
    if link.password_hash and not is_owner:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not verify_password(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Increment view count
    link.view_count += 1
    link.last_accessed_at = datetime.now()
    db.commit()
    
    # Return file info
    file = link.file
    return {
        "file": {
            "id": file.id,
            "filename": file.filename,
            "file_type": file.file_type,
            "file_size": file.file_size,
            "thumbnail": file.thumbnail,
            "duration": file.duration,
            "original_url": file.original_url
        },
        "share_info": {
            "title": link.title or file.filename.split('/')[-1],
            "allow_download": bool(link.allow_download),
            "view_count": link.view_count,
            "max_views": link.max_views,
            "expires_at": link.expires_at
        }
    }


@router.get("/stats")
async def get_share_link_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics for user's share links"""
    if not check_permission(current_user, 'can_create_share_links'):
        raise HTTPException(status_code=403, detail="No permission to view share link stats")
    
    links = db.query(ShareToken).filter(ShareToken.user_id == current_user.id).all()
    
    total_links = len(links)
    active_links = sum(1 for link in links if link.is_active)
    total_views = sum(link.view_count for link in links)
    
    return {
        "total_links": total_links,
        "active_links": active_links,
        "inactive_links": total_links - active_links,
        "total_views": total_views
    }


@router.get("/file/{token}/{file_id}")
async def get_shared_file_stream(
    token: str,
    file_id: int,
    password: Optional[str] = None,
    download: Optional[bool] = False,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Stream or download a file through a share link"""
    from fastapi.responses import FileResponse
    from pathlib import Path
    
    # Try to get current user if authenticated
    current_user = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from ..auth import verify_token
            auth_token = authorization.split(" ")[1]
            payload = verify_token(auth_token)
            username = payload.get("sub")
            if username:
                current_user = db.query(User).filter(User.username == username).first()
        except Exception as e:
            print(f"[ShareLink Stream] Auth error: {e}")
            pass
    
    # Get share link
    link = db.query(ShareToken).filter(ShareToken.token == token).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Verify file_id matches
    if link.file_id != file_id:
        raise HTTPException(status_code=403, detail="File does not match share link")
    
    # Check if active
    if not link.is_active:
        raise HTTPException(status_code=403, detail="Share link is disabled")
    
    # Check if expired
    if link.expires_at and link.expires_at < datetime.now():
        raise HTTPException(status_code=403, detail="Share link has expired")
    
    # Check max views
    if link.max_views and link.view_count >= link.max_views:
        raise HTTPException(status_code=403, detail="Share link has reached maximum views")
    
    # Check anonymous access - logged in users can always access
    if not current_user and not link.allow_anonymous:
        raise HTTPException(status_code=401, detail="Login required to access this link")
    
    # Check password (skip for file owner)
    is_owner = current_user and current_user.id == link.user_id
    if link.password_hash and not is_owner:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not verify_password(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Check if download is allowed
    if download and not link.allow_download:
        raise HTTPException(status_code=403, detail="Download is not allowed for this link")
    
    # Get file
    file = link.file
    file_path = Path("/app/downloads") / file.filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Return file for streaming or download
    actual_filename = Path(file.filename).name
    
    # Set headers based on download parameter
    headers = {}
    if download:
        # Force download with attachment header
        headers["Content-Disposition"] = f'attachment; filename="{actual_filename}"'
    
    return FileResponse(
        path=file_path,
        filename=actual_filename,
        media_type='application/octet-stream',
        headers=headers
    )


@router.get("/thumbnail/{token}/{file_id}")
async def get_share_link_thumbnail(
    token: str,
    file_id: int,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get thumbnail for a shared file"""
    from pathlib import Path
    from fastapi.responses import FileResponse, RedirectResponse
    
    # Get share link
    share_link = db.query(ShareToken).filter(ShareToken.token == token).first()
    
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check if link is active
    if not share_link.is_active:
        raise HTTPException(status_code=403, detail="Share link is inactive")
    
    # Check expiration
    if share_link.expires_at and share_link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Share link has expired")
    
    # Check max views
    if share_link.max_views and share_link.view_count >= share_link.max_views:
        raise HTTPException(status_code=403, detail="Share link has reached maximum views")
    
    # Check password
    if share_link.password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not verify_password(password, share_link.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    # Get file
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id,
        DownloadedFile.id == share_link.file_id
    ).first()
    
    if not file or not file.thumbnail:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    # If thumbnail is a URL (YouTube), redirect to it
    if file.thumbnail.startswith('http'):
        return RedirectResponse(url=file.thumbnail)
    
    # Otherwise, serve local thumbnail file
    thumbnail_path = Path("/app/downloads") / file.thumbnail
    
    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    
    # Determine media type
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
