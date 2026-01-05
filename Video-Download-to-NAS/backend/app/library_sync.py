"""
Library synchronization module for scanning download folders and registering files to database.
"""
import os
import asyncio
import subprocess
from pathlib import Path
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from .database import User, DownloadedFile

# Import Path at module level to ensure it's available
Path = Path

DOWNLOADS_DIR = "/app/downloads"


async def extract_video_metadata(file_path: str) -> Dict:
    """Extract metadata from video file using FFprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            file_path
        ]
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, timeout=30)
        )
        
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout.decode())
            
            # Extract duration
            duration = None
            if 'format' in data and 'duration' in data['format']:
                try:
                    duration = int(float(data['format']['duration']))
                except (ValueError, TypeError):
                    pass
            
            # Extract video stream metadata
            resolution = None
            video_codec = None
            framerate = None
            audio_codec = None
            bitrate = None
            
            if 'streams' in data:
                for stream in data['streams']:
                    # Video stream
                    if stream.get('codec_type') == 'video':
                        # Resolution
                        width = stream.get('width')
                        height = stream.get('height')
                        if width and height:
                            resolution = f"{width}x{height}"
                        
                        # Video codec
                        video_codec = stream.get('codec_name')
                        
                        # Framerate
                        fps_str = stream.get('r_frame_rate', '0/0')
                        try:
                            num, den = map(int, fps_str.split('/'))
                            if den > 0:
                                framerate = round(num / den, 2)
                        except:
                            pass
                    
                    # Audio stream
                    elif stream.get('codec_type') == 'audio':
                        audio_codec = stream.get('codec_name')
            
            # Bitrate from format
            if 'format' in data and 'bit_rate' in data['format']:
                try:
                    bitrate = int(data['format']['bit_rate'])
                except (ValueError, TypeError):
                    pass
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            return {
                'duration': duration,
                'file_size': file_size,
                'resolution': resolution,
                'video_codec': video_codec,
                'audio_codec': audio_codec,
                'framerate': framerate,
                'bitrate': bitrate
            }
    except Exception as e:
        print(f"[Metadata] Error extracting metadata: {e}")
    
    return {
        'duration': None,
        'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else None,
        'resolution': None,
        'video_codec': None,
        'audio_codec': None,
        'framerate': None,
        'bitrate': None
    }


async def generate_thumbnail(video_path: str, output_dir: str) -> Optional[str]:
    """Generate thumbnail from video file"""
    try:
        video_name = Path(video_path).stem
        thumbnail_path = os.path.join(output_dir, f"{video_name}_thumb.jpg")
        
        # Skip if thumbnail already exists
        if os.path.exists(thumbnail_path):
            print(f"[Thumbnail] Already exists: {thumbnail_path}")
            return thumbnail_path
        
        print(f"[Thumbnail] Generating for: {video_path}")
        
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', '00:00:01',
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            thumbnail_path
        ]
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, timeout=30)
        )
        
        if result.returncode == 0 and os.path.exists(thumbnail_path):
            print(f"[Thumbnail] Generated successfully: {thumbnail_path}")
            return thumbnail_path
        else:
            stderr = result.stderr.decode() if result.stderr else 'No error output'
            print(f"[Thumbnail] FFmpeg failed (code {result.returncode}): {stderr}")
            return None
            
    except Exception as e:
        print(f"[Thumbnail] Error: {e}")
        import traceback
        traceback.print_exc()
    
    return None


def get_file_type(file_path: str) -> str:
    """Determine file type based on extension"""
    ext = Path(file_path).suffix.lower()
    
    video_exts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.wmv', '.m4v']
    audio_exts = ['.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.aac', '.wma']
    subtitle_exts = ['.srt', '.vtt', '.ass', '.ssa', '.sub']
    
    if ext in video_exts:
        return 'video'
    elif ext in audio_exts:
        return 'audio'
    elif ext in subtitle_exts:
        return 'subtitle'
    
    return 'video'  # Default to video


async def sync_user_library(
    db: Session,
    user_id: int,
    username: str,
    progress_callback=None
) -> Dict:
    """Sync library for a specific user"""
    user_dir = os.path.join(DOWNLOADS_DIR, username)
    
    if not os.path.exists(user_dir):
        return {
            'scanned': 0,
            'added': 0,
            'skipped': 0,
            'errors': 0,
            'error_message': f"User directory not found: {user_dir}"
        }
    
    scanned = 0
    added = 0
    skipped = 0
    errors = 0
    
    # Get all files in user directory
    for root, dirs, files in os.walk(user_dir):
        # Skip system directories
        dirs[:] = [d for d in dirs if not d.startswith('@') and not d.startswith('.')]
        
        for filename in files:
            # Skip thumbnail files (both generated and downloaded)
            if (filename.endswith('_thumb.jpg') or 
                filename.endswith('.webp') or 
                filename.endswith('.jpg') or 
                filename.endswith('.jpeg') or 
                filename.endswith('.png')):
                continue
            
            # Skip system files and non-media files
            if (filename.startswith('.') or 
                filename.startswith('@') or
                filename == 'SYNOINDEX_MEDIA_INFO' or
                filename.endswith('.ini') or
                filename.endswith('.db') or
                filename.endswith('.txt') or
                filename.endswith('.nfo')):
                continue
            
            # Only process media files
            ext = os.path.splitext(filename)[1].lower()
            media_extensions = [
                # Video
                '.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.wmv', '.m4v',
                # Audio
                '.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.aac', '.wma',
                # Subtitle
                '.srt', '.vtt', '.ass', '.ssa', '.sub'
            ]
            
            if ext not in media_extensions:
                continue
            
            file_path = os.path.join(root, filename)
            relative_path = os.path.relpath(file_path, DOWNLOADS_DIR)
            
            scanned += 1
            
            if progress_callback:
                await progress_callback({
                    'status': 'scanning',
                    'current_file': filename,
                    'scanned': scanned,
                    'added': added
                })
            
            try:
                # Check if file already exists in database
                existing = db.query(DownloadedFile).filter(
                    DownloadedFile.filename == relative_path,
                    DownloadedFile.user_id == user_id
                ).first()
                
                if existing:
                    skipped += 1
                    continue
                
                # Determine file type
                file_type = get_file_type(file_path)
                
                # Extract metadata for video/audio files
                metadata = {'duration': None, 'file_size': None}
                thumbnail_path = None
                
                if file_type in ['video', 'audio']:
                    metadata = await extract_video_metadata(file_path)
                    
                    # Look for thumbnails for both video and audio files
                    media_name = Path(file_path).stem
                    media_dir = os.path.dirname(file_path)
                    
                    print(f"[Sync] {file_type.capitalize()}: {file_path}")
                    
                    # Check for existing thumbnails in order of preference
                    # 1. Generated JPG thumbnail
                    jpg_thumb = os.path.join(media_dir, f"{media_name}_thumb.jpg")
                    # 2. YouTube downloaded webp thumbnail
                    webp_thumb = os.path.join(media_dir, f"{media_name}.webp")
                    # 3. Other image formats
                    jpg_thumb_alt = os.path.join(media_dir, f"{media_name}.jpg")
                    png_thumb = os.path.join(media_dir, f"{media_name}.png")
                    
                    if os.path.exists(jpg_thumb):
                        thumbnail_path = os.path.relpath(jpg_thumb, DOWNLOADS_DIR)
                        print(f"[Sync] Using existing JPG thumbnail: {thumbnail_path}")
                    elif os.path.exists(webp_thumb):
                        thumbnail_path = os.path.relpath(webp_thumb, DOWNLOADS_DIR)
                        print(f"[Sync] Using YouTube webp thumbnail: {thumbnail_path}")
                    elif os.path.exists(jpg_thumb_alt):
                        thumbnail_path = os.path.relpath(jpg_thumb_alt, DOWNLOADS_DIR)
                        print(f"[Sync] Using alternative JPG thumbnail: {thumbnail_path}")
                    elif os.path.exists(png_thumb):
                        thumbnail_path = os.path.relpath(png_thumb, DOWNLOADS_DIR)
                        print(f"[Sync] Using PNG thumbnail: {thumbnail_path}")
                    elif file_type == 'video':
                        # Only generate thumbnails for videos, not audio
                        print(f"[Sync] No existing thumbnail found, generating...")
                        generated_thumb = await generate_thumbnail(file_path, media_dir)
                        if generated_thumb:
                            thumbnail_path = os.path.relpath(generated_thumb, DOWNLOADS_DIR)
                            print(f"[Sync] Generated thumbnail: {thumbnail_path}")
                        else:
                            print(f"[Sync] Failed to generate thumbnail")
                    else:
                        print(f"[Sync] No thumbnail found for audio file (cannot generate from audio)")
                
                # Create database entry
                new_file = DownloadedFile(
                    filename=relative_path,
                    original_url='',  # No URL for synced files
                    file_type=file_type,
                    file_size=metadata['file_size'],
                    thumbnail=thumbnail_path,
                    duration=metadata['duration'],
                    resolution=metadata.get('resolution'),
                    video_codec=metadata.get('video_codec'),
                    audio_codec=metadata.get('audio_codec'),
                    bitrate=metadata.get('bitrate'),
                    framerate=metadata.get('framerate'),
                    user_id=user_id
                )
                
                db.add(new_file)
                db.commit()
                added += 1
                
            except Exception as e:
                print(f"[Sync] Error processing {filename}: {e}")
                errors += 1
                db.rollback()
    
    return {
        'scanned': scanned,
        'added': added,
        'skipped': skipped,
        'errors': errors
    }


async def sync_all_libraries(db: Session, progress_callback=None) -> Dict:
    """Sync libraries for all users"""
    total_results = {
        'scanned': 0,
        'added': 0,
        'skipped': 0,
        'errors': 0,
        'users_processed': 0
    }
    
    # Get all users
    users = db.query(User).all()
    
    for user in users:
        if progress_callback:
            await progress_callback({
                'status': 'processing_user',
                'username': user.username,
                'user_id': user.id
            })
        
        result = await sync_user_library(db, user.id, user.username, progress_callback)
        
        total_results['scanned'] += result['scanned']
        total_results['added'] += result['added']
        total_results['skipped'] += result['skipped']
        total_results['errors'] += result['errors']
        total_results['users_processed'] += 1
    
    return total_results
