"""
Admin metadata management endpoints
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db, DownloadedFile, User
from ..auth import get_current_user
from ..permissions import require_role
import os
import logging

router = APIRouter(prefix="/api/admin/metadata", tags=["admin-metadata"])
logger = logging.getLogger(__name__)

DOWNLOADS_DIR = "/app/downloads"
BATCH_SIZE = 50


def process_metadata_migration(db: Session, force_reextract: bool = False):
    """
    Background task to extract metadata from existing video files
    
    This function:
    1. Queries video files (with or without existing metadata based on force_reextract)
    2. Processes them in batches of 50
    3. Extracts metadata using ffprobe
    4. Updates database records
    5. Commits after each batch
    
    Args:
        db: Database session
        force_reextract: If True, re-extract metadata for all video files.
                        If False, only extract for files with resolution == NULL
    """
    from ..metadata_extractor import extract_metadata_from_file
    
    logger.info(f"Starting metadata migration (force_reextract={force_reextract})...")
    
    try:
        # Query video files
        query = db.query(DownloadedFile).filter(DownloadedFile.file_type == 'video')
        
        if not force_reextract:
            # Only process files without resolution
            query = query.filter(DownloadedFile.resolution == None)
        
        files = query.all()
        
        total_files = len(files)
        logger.info(f"Found {total_files} video files without resolution")
        
        if total_files == 0:
            logger.info("No files to process")
            return
        
        processed = 0
        updated = 0
        failed = 0
        
        # Process in batches
        for i in range(0, total_files, BATCH_SIZE):
            batch = files[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (total_files + BATCH_SIZE - 1) // BATCH_SIZE
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} files)")
            
            for file in batch:
                try:
                    # Build absolute file path
                    file_path = os.path.join(DOWNLOADS_DIR, file.filename)
                    
                    # Check if file exists
                    if not os.path.exists(file_path):
                        logger.warning(f"File not found: {file_path}")
                        failed += 1
                        continue
                    
                    # Extract metadata
                    metadata = extract_metadata_from_file(file_path)
                    
                    # Update file record
                    updated_any = False
                    if metadata.get('resolution'):
                        file.resolution = metadata['resolution']
                        updated_any = True
                    if metadata.get('video_codec'):
                        file.video_codec = metadata['video_codec']
                        updated_any = True
                    if metadata.get('audio_codec'):
                        file.audio_codec = metadata['audio_codec']
                        updated_any = True
                    if metadata.get('bitrate'):
                        file.bitrate = metadata['bitrate']
                        updated_any = True
                    if metadata.get('framerate'):
                        file.framerate = metadata['framerate']
                        updated_any = True
                    
                    if updated_any:
                        updated += 1
                        logger.debug(f"Updated {file.filename}: {metadata}")
                    else:
                        logger.warning(f"Could not extract metadata from {file.filename}")
                        failed += 1
                    
                    processed += 1
                    
                except Exception as e:
                    logger.error(f"Error processing {file.filename}: {e}")
                    failed += 1
                    continue
            
            # Commit batch
            try:
                db.commit()
                logger.info(f"Batch {batch_num} committed: {updated} updated, {failed} failed")
            except Exception as e:
                logger.error(f"Failed to commit batch {batch_num}: {e}")
                db.rollback()
        
        logger.info(f"Metadata migration completed: {processed} processed, {updated} updated, {failed} failed")
        
    except Exception as e:
        logger.error(f"Metadata migration failed: {e}")
        db.rollback()
    finally:
        db.close()


@router.post("/migrate")
async def migrate_metadata(
    background_tasks: BackgroundTasks,
    force_reextract: bool = False,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Start metadata extraction for existing video files (super_admin only)
    
    This endpoint:
    - Immediately returns 202 Accepted
    - Starts background task to process files
    - If force_reextract=False: Processes only files with resolution == NULL
    - If force_reextract=True: Re-extracts metadata for ALL video files
    - Can be called multiple times (auto-resume)
    
    Args:
        force_reextract: If True, re-extract metadata for all video files
    """
    # Add background task
    background_tasks.add_task(process_metadata_migration, db, force_reextract)
    
    # Count files to process
    query = db.query(DownloadedFile).filter(DownloadedFile.file_type == 'video')
    
    if not force_reextract:
        query = query.filter(DownloadedFile.resolution == None)
    
    pending_count = query.count()
    
    logger.info(f"Metadata migration started by user {current_user.id}, {pending_count} files pending (force_reextract={force_reextract})")
    
    return {
        "status": "started",
        "message": "Metadata extraction started in background",
        "pending_files": pending_count,
        "force_reextract": force_reextract
    }
