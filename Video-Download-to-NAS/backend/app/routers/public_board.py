from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pathlib import Path

from ..database import get_db, User, DownloadedFile
from ..auth import get_current_user
from ..permissions import check_permission

router = APIRouter(prefix="/api/public-board", tags=["public-board"])


@router.get("/files")
async def get_public_files(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get public files from the board"""
    # Check permission
    if not check_permission(current_user, 'can_view_public_board'):
        raise HTTPException(status_code=403, detail="No permission to view public board")
    
    # Build query
    query = db.query(DownloadedFile).filter(DownloadedFile.is_public == 1)
    
    # Add search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (DownloadedFile.public_title.like(search_term)) |
            (DownloadedFile.filename.like(search_term)) |
            (DownloadedFile.public_description.like(search_term))
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * limit
    files = query.order_by(DownloadedFile.created_at.desc()).offset(offset).limit(limit).all()
    
    # Format response
    result = []
    for file in files:
        file_data = {
            "id": file.id,
            "filename": file.filename,
            "original_url": file.original_url,
            "file_type": file.file_type,
            "file_size": file.file_size,
            "thumbnail": file.thumbnail,
            "duration": file.duration,
            "public_title": file.public_title or file.filename.split('/')[-1],
            "public_description": file.public_description,
            "created_at": file.created_at,
            "uploader": {
                "id": file.user.id,
                "username": file.user.display_name or file.user.username
            }
        }
        result.append(file_data)
    
    return {
        "files": result,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }


@router.post("/files/{file_id}/publish")
async def publish_file_to_board(
    file_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Publish a file to the public board"""
    # Check permission
    if not check_permission(current_user, 'can_post_to_public_board'):
        raise HTTPException(status_code=403, detail="No permission to post to public board")
    
    # Get file
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id,
        DownloadedFile.user_id == current_user.id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found or not owned by user")
    
    # Update file to be public
    file.is_public = 1
    file.public_title = data.get('title') or file.filename.split('/')[-1]
    file.public_description = data.get('description')
    
    db.commit()
    
    return {"message": "File published to public board successfully"}


@router.delete("/files/{file_id}/unpublish")
async def unpublish_file_from_board(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a file from the public board"""
    # Get file
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check permission: owner or super_admin
    if file.user_id != current_user.id and current_user.role != 'super_admin':
        raise HTTPException(status_code=403, detail="No permission to unpublish this file")
    
    # Make file private
    file.is_public = 0
    file.public_title = None
    file.public_description = None
    
    db.commit()
    
    return {"message": "File removed from public board successfully"}


@router.get("/files/{file_id}")
async def get_public_file_details(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a public file"""
    # Check permission
    if not check_permission(current_user, 'can_view_public_board'):
        raise HTTPException(status_code=403, detail="No permission to view public board")
    
    # Get file
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id,
        DownloadedFile.is_public == 1
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="Public file not found")
    
    return {
        "id": file.id,
        "filename": file.filename,
        "original_url": file.original_url,
        "file_type": file.file_type,
        "file_size": file.file_size,
        "thumbnail": file.thumbnail,
        "duration": file.duration,
        "public_title": file.public_title,
        "public_description": file.public_description,
        "created_at": file.created_at,
        "uploader": {
            "id": file.user.id,
            "username": file.user.display_name or file.user.username
        }
    }


@router.get("/files/{file_id}/stream")
async def stream_public_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stream a public file"""
    # Check permission
    if not check_permission(current_user, 'can_view_public_board'):
        raise HTTPException(status_code=403, detail="No permission to view public board")
    
    # Get file - must be public
    file = db.query(DownloadedFile).filter(
        DownloadedFile.id == file_id,
        DownloadedFile.is_public == 1
    ).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="Public file not found")
    
    # Build file path
    file_path = Path("/app/downloads") / file.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Return only the actual filename, not the path
    actual_filename = Path(file.filename).name
    return FileResponse(
        path=file_path,
        filename=actual_filename,
        media_type='application/octet-stream'
    )
