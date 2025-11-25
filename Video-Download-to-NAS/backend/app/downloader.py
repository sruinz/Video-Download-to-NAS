import yt_dlp
import os
import asyncio
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from .database import DownloadedFile

DOWNLOADS_DIR = "/app/downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Global download status tracker
download_status: Dict[str, dict] = {}

def get_resolution_priority(resolution: str) -> int:
    """Get priority value for resolution (higher is better)"""
    priority_map = {
        'best': 9999,
        '2160p': 2160,
        '1440p': 1440,
        '1080p': 1080,
        '720p': 720,
        '480p': 480,
        '360p': 360,
        '240p': 240,
        '144p': 144,
    }
    return priority_map.get(resolution, 0)

def parse_resolution(resolution: str) -> dict:
    """Parse resolution string into yt-dlp format options"""

    # Audio formats
    if resolution.startswith('audio-'):
        audio_format = resolution.split('-')[1]
        return {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': audio_format,
                'preferredquality': '192',
            }],
            'file_type': 'audio'
        }

    # Subtitle formats
    if resolution.startswith('srt') or resolution.startswith('vtt'):
        parts = resolution.split('|')
        subtitle_format = parts[0]
        language = parts[1] if len(parts) > 1 else 'en'
        return {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': [language],
            'subtitlesformat': subtitle_format,
            'file_type': 'subtitle'
        }

    # Video formats
    format_map = {
        'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '2160p': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]',
        '1440p': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440]',
        '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]',
        '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]',
        '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]',
        '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]',
        '240p': 'bestvideo[height<=240][ext=mp4]+bestaudio[ext=m4a]/best[height<=240]',
        '144p': 'bestvideo[height<=144][ext=mp4]+bestaudio[ext=m4a]/best[height<=144]',
    }

    return {
        'format': format_map.get(resolution, format_map['best']),
        'file_type': 'video'
    }

def progress_hook(d: dict, download_id: str, user_id: int = None, ws_manager = None, event_loop = None, telegram_notifier = None):
    """Hook to track download progress and send WebSocket updates"""
    if d['status'] == 'downloading':
        downloaded = d.get('downloaded_bytes', 0)
        total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        if total > 0:
            progress = (downloaded / total) * 100
            speed = d.get('speed', 0)
            eta = d.get('eta', 0)
            
            download_status[download_id] = {
                'status': 'downloading',
                'progress': progress,
                'speed': speed,
                'eta': eta,
                'filename': d.get('filename', ''),
                'error': None
            }
            
            # Send WebSocket update if available
            if ws_manager and user_id and event_loop:
                try:
                    print(f"[Progress] Sending progress: {round(progress, 2)}% (speed: {speed}, eta: {eta})")
                    asyncio.run_coroutine_threadsafe(
                        ws_manager.send_progress(user_id, download_id, {
                            'progress': round(progress, 2),
                            'speed': speed or 0,
                            'eta': eta or 0,
                            'filename': os.path.basename(d.get('filename', '')),
                            'status': 'downloading'
                        }),
                        event_loop
                    )
                except Exception as e:
                    # Don't fail download if WebSocket fails
                    print(f"[Progress] WebSocket error: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Send Telegram progress notification (1초마다 업데이트)
            # 하나의 메시지를 계속 수정하는 방식
            if telegram_notifier and user_id and event_loop:
                current_status = download_status.get(download_id, {})
                
                # 이미 완료 상태면 진행 상황 알림 전송 안 함
                if current_status.get('status') == 'completed':
                    return
                
                # 1초마다 진행률 업데이트 (알림 함수에서 체크)
                try:
                    print(f"[Telegram] Updating progress: {progress:.2f}%")
                    asyncio.run_coroutine_threadsafe(
                        telegram_notifier.send_download_progress_notification(
                            user_id=user_id,
                            download_id=download_id,
                            filename=os.path.basename(d.get('filename', '')),
                            progress=progress,  # 실제 진행률 전송
                            speed=speed,
                            eta=eta
                        ),
                        event_loop
                    )
                except Exception as e:
                    print(f"[Telegram] Progress notification error: {e}")
                    
    elif d['status'] == 'finished':
        # 기존 상태 유지하면서 업데이트 (마일스톤 키 보존)
        if download_id in download_status:
            download_status[download_id].update({
                'status': 'completed',
                'progress': 100.0,
                'filename': d.get('filename', ''),
                'error': None
            })
        else:
            download_status[download_id] = {
                'status': 'completed',
                'progress': 100.0,
                'filename': d.get('filename', ''),
                'error': None
            }

async def download_video(
    url: str,
    resolution: str,
    download_id: str,
    db: Session,
    user_id: int,
    ws_manager = None
) -> dict:
    """Download video using yt-dlp"""
    from .database import User
    from .telegram.notifications import notification_manager
    import logging
    
    logger = logging.getLogger(__name__)
    print(f"[Download] Starting: {download_id} for user {user_id}")
    print(f"[Download] WebSocket manager available: {ws_manager is not None}")
    logger.info(f"Starting download: {download_id} for user {user_id}, URL: {url}, Resolution: {resolution}")
    logger.info(f"WebSocket manager: {ws_manager is not None}")

    try:
        download_status[download_id] = {
            'status': 'pending',
            'progress': 0.0,
            'filename': None,
            'error': None
        }

        # Get username for folder structure
        user = db.query(User).filter(User.id == user_id).first()
        username = user.username if user else f"user_{user_id}"
        
        # Create user-specific download directory
        user_download_dir = os.path.join(DOWNLOADS_DIR, username)
        os.makedirs(user_download_dir, exist_ok=True)

        # Parse resolution options
        options = parse_resolution(resolution)
        file_type = options.pop('file_type', 'video')

        # Get current event loop to pass to progress_hook
        loop = asyncio.get_event_loop()

        # Base yt-dlp options
        ydl_opts = {
            'outtmpl': os.path.join(user_download_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, download_id, user_id, ws_manager, loop, notification_manager)],
            'writethumbnail': True,
            'embedthumbnail': True,
            'noplaylist': False,  # Allow playlist downloads
            'yes_playlist': True,  # Download entire playlist if URL is a playlist
            **options
        }

        download_status[download_id]['status'] = 'downloading'
        
        # Send download started event via WebSocket
        if ws_manager:
            try:
                print(f"[WebSocket] Sending download_started for {download_id}")
                await ws_manager.send_download_started(
                    user_id, 
                    download_id, 
                    url, 
                    resolution,
                    "Preparing download..."
                )
            except Exception as e:
                print(f"[WebSocket] Error sending download_started: {e}")

        # Run download in executor to avoid blocking
        result = await loop.run_in_executor(
            None,
            lambda: _download_with_ydl(ydl_opts, url)
        )

        # Determine expected extension based on resolution option
        # This is more reliable than checking the actual file
        expected_extension = '.mp4'  # default for video
        if resolution.startswith('audio-'):
            audio_format = resolution.split('-')[1]
            expected_extension = f'.{audio_format}'
        elif resolution.startswith('srt') or resolution.startswith('vtt'):
            subtitle_format = resolution.split('|')[0]
            expected_extension = f'.{subtitle_format}'
        
        print(f"[Download] Resolution: {resolution}, Expected extension: {expected_extension}")
        
        # Get the actual downloaded file path
        full_path = result['filename']
        actual_extension = os.path.splitext(full_path)[1].lower()
        
        # If extensions don't match, rename the file to match expected extension
        if actual_extension != expected_extension:
            print(f"[Download] Extension mismatch: {actual_extension} vs {expected_extension}")
            base_path = os.path.splitext(full_path)[0]
            new_path = base_path + expected_extension
            
            # Check if file with expected extension already exists
            if os.path.exists(new_path) and new_path != full_path:
                print(f"[Download] Removing old file: {new_path}")
                os.remove(new_path)
            
            # Rename file to expected extension
            if os.path.exists(full_path):
                print(f"[Download] Renaming {full_path} to {new_path}")
                os.rename(full_path, new_path)
                full_path = new_path
        
        relative_path = os.path.relpath(full_path, DOWNLOADS_DIR)
        file_extension = expected_extension
        
        print(f"[Download] Final file path: {full_path}")
        print(f"[Download] Relative path: {relative_path}")
        print(f"[Download] Final extension: {file_extension}")
        
        actual_file_type = file_type
        
        # Override file type based on actual extension
        audio_extensions = ['.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.aac']
        video_extensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv']
        subtitle_extensions = ['.srt', '.vtt', '.ass', '.ssa']
        
        if file_extension in audio_extensions:
            actual_file_type = 'audio'
        elif file_extension in video_extensions:
            actual_file_type = 'video'
        elif file_extension in subtitle_extensions:
            actual_file_type = 'subtitle'
        
        # Check for existing file with same URL and extension (for duplicate prevention)
        # Only update if the file extension matches (same format)
        existing_file = db.query(DownloadedFile).filter(
            DownloadedFile.original_url == url,
            DownloadedFile.user_id == user_id
        ).first()
        
        should_update = False
        if existing_file:
            # Check if extensions match
            existing_ext = os.path.splitext(existing_file.filename)[1].lower()
            if existing_ext == file_extension:
                should_update = True
                print(f"[Download] Same extension detected, updating existing file: {existing_file.id}")
            else:
                print(f"[Download] Different extension ({existing_ext} vs {file_extension}), creating new record")
        
        # Update existing file or create new one
        if should_update:
            # Update existing record
            existing_file.filename = relative_path
            existing_file.file_type = actual_file_type
            existing_file.file_size = result.get('filesize')
            existing_file.thumbnail = result.get('thumbnail')
            existing_file.duration = result.get('duration')
            file_info = existing_file
        else:
            # Create new record
            print(f"[Download] Creating new file record")
            file_info = DownloadedFile(
                filename=relative_path,
                original_url=url,
                file_type=actual_file_type,
                file_size=result.get('filesize'),
                thumbnail=result.get('thumbnail'),
                duration=result.get('duration'),
                user_id=user_id
            )
            db.add(file_info)
        
        db.commit()
        db.refresh(file_info)
        
        # Generate thumbnail from video if not available and file is video
        if actual_file_type == 'video' and not file_info.thumbnail:
            try:
                thumbnail_path = await generate_video_thumbnail(full_path, user_download_dir)
                if thumbnail_path:
                    file_info.thumbnail = os.path.relpath(thumbnail_path, DOWNLOADS_DIR)
                    db.commit()
                    db.refresh(file_info)
                    print(f"[Download] Generated thumbnail: {thumbnail_path}")
            except Exception as e:
                print(f"[Download] Failed to generate thumbnail: {e}")

        download_status[download_id]['status'] = 'completed'
        download_status[download_id]['filename'] = relative_path

        # Send download completed event via WebSocket
        if ws_manager:
            try:
                print(f"[WebSocket] Sending download_completed for {download_id}")
                await ws_manager.send_download_completed(
                    user_id,
                    download_id,
                    os.path.basename(relative_path),
                    file_info.id,
                    result.get('filesize', 0)
                )
            except Exception as e:
                print(f"[WebSocket] Error sending download_completed: {e}")
        
        # Send Telegram notification for download completion
        # 완료 알림은 한 번만 전송되도록 체크
        if not download_status[download_id].get('telegram_notified'):
            try:
                print(f"[Telegram] Sending download complete notification")
                await notification_manager.send_download_complete_notification(
                    user_id=user_id,
                    filename=os.path.basename(relative_path),
                    file_size=result.get('filesize', 0),
                    download_id=download_id
                )
                # 알림 전송 완료 표시
                download_status[download_id]['telegram_notified'] = True
            except Exception as e:
                print(f"[Telegram] Error sending download complete notification: {e}")

        return {
            'status': 'success',
            'filename': result['filename'],
            'file_id': file_info.id
        }

    except Exception as e:
        error_str = str(e)
        download_status[download_id] = {
            'status': 'failed',
            'progress': 0.0,
            'filename': None,
            'error': error_str
        }
        
        # Detect error type
        error_type = 'unknown'
        if 'network' in error_str.lower() or 'connection' in error_str.lower():
            error_type = 'network'
        elif 'url' in error_str.lower() or 'invalid' in error_str.lower():
            error_type = 'invalid_url'
        elif 'geo' in error_str.lower() or 'region' in error_str.lower() or 'country' in error_str.lower():
            error_type = 'geo_restriction'
        
        # Send download failed event via WebSocket
        if ws_manager:
            try:
                await ws_manager.send_download_failed(
                    user_id,
                    download_id,
                    error_str,
                    error_type
                )
            except Exception:
                pass
        
        # Send Telegram notification for download failure
        try:
            print(f"[Telegram] Sending download failed notification")
            await notification_manager.send_download_failed_notification(
                user_id=user_id,
                url=url,
                error_message=error_str,
                download_id=download_id
            )
        except Exception as e:
            print(f"[Telegram] Error sending download failed notification: {e}")
        
        return {
            'status': 'error',
            'message': error_str
        }

def _download_with_ydl(ydl_opts: dict, url: str) -> dict:
    """Helper function to run yt-dlp download"""
    import os
    from pathlib import Path
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        expected_filename = ydl.prepare_filename(info)
        
        print(f"[yt-dlp] Expected filename: {expected_filename}")
        
        # For audio files, yt-dlp changes the extension after post-processing
        # Check if the file exists, if not, try common audio extensions
        actual_filename = expected_filename
        if not os.path.exists(expected_filename):
            base_path = Path(expected_filename).with_suffix('')
            print(f"[yt-dlp] Expected file not found, checking alternatives for: {base_path}")
            for ext in ['.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.aac']:
                test_path = str(base_path) + ext
                if os.path.exists(test_path):
                    actual_filename = test_path
                    print(f"[yt-dlp] Found actual file: {actual_filename}")
                    break
        else:
            print(f"[yt-dlp] File exists at expected location: {expected_filename}")
        
        # Get actual file size from disk
        filesize = None
        if os.path.exists(actual_filename):
            filesize = os.path.getsize(actual_filename)
        
        return {
            'filename': actual_filename,
            'filesize': filesize,
            'thumbnail': info.get('thumbnail'),
            'duration': info.get('duration'),
            'title': info.get('title')
        }

async def generate_video_thumbnail(video_path: str, output_dir: str) -> Optional[str]:
    """Generate thumbnail from video file using FFmpeg"""
    import subprocess
    from pathlib import Path
    
    try:
        # Create thumbnail filename
        video_name = Path(video_path).stem
        thumbnail_path = os.path.join(output_dir, f"{video_name}_thumb.jpg")
        
        # Skip if thumbnail already exists
        if os.path.exists(thumbnail_path):
            return thumbnail_path
        
        # Use FFmpeg to extract frame at 10% of video duration
        # -ss 00:00:01 = seek to 1 second
        # -vframes 1 = extract 1 frame
        # -q:v 2 = quality (2 is high quality)
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', '00:00:01',  # Take frame at 1 second
            '-vframes', '1',
            '-q:v', '2',
            '-y',  # Overwrite output file
            thumbnail_path
        ]
        
        # Run FFmpeg
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                cmd,
                capture_output=True,
                timeout=30
            )
        )
        
        if result.returncode == 0 and os.path.exists(thumbnail_path):
            print(f"[Thumbnail] Generated successfully: {thumbnail_path}")
            return thumbnail_path
        else:
            print(f"[Thumbnail] FFmpeg failed: {result.stderr.decode()}")
            return None
            
    except Exception as e:
        print(f"[Thumbnail] Error generating thumbnail: {e}")
        return None

def get_download_status(download_id: str) -> Optional[dict]:
    """Get current download status"""
    return download_status.get(download_id)
