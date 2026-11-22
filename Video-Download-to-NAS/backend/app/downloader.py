import yt_dlp
import os
import asyncio
import re
import shutil
from typing import Dict, Optional
from datetime import datetime
from pathlib import Path
from weakref import WeakKeyDictionary
from sqlalchemy.orm import Session
from .database import DownloadedFile
from .subtitle_helper import (
    build_companion_subtitle_filename,
    normalize_subtitle_format,
    parse_subtitle_languages,
)

DOWNLOADS_DIR = "/app/downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Global download status tracker
download_status: Dict[str, dict] = {}
RATE_LIMIT_RETRY_DELAYS = (30, 60)
_download_execution_locks = WeakKeyDictionary()
VIDEO_EXTENSIONS = frozenset({
    '.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.3gp', '.m4v',
    '.mpg', '.mpeg', '.ts', '.m2ts', '.f4v', '.ogv',
})
AUDIO_EXTENSIONS = frozenset({
    '.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac', '.aac', '.wma',
    '.alac', '.aiff',
})
SUBTITLE_EXTENSIONS = frozenset({
    '.srt', '.vtt', '.ass', '.ssa', '.lrc', '.ttml', '.dfxp', '.srv1',
    '.srv2', '.srv3', '.json3',
})
COMPLETED_DOWNLOAD_EXTENSIONS = (
    VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | SUBTITLE_EXTENSIONS
)


def _duration_in_seconds(value) -> Optional[int]:
    """추출기가 반환한 길이를 라이브러리의 정수 초 단위로 정리한다."""
    if value is None:
        return None

    try:
        return int(float(value))
    except (TypeError, ValueError, OverflowError):
        return None


def _get_download_execution_lock() -> asyncio.Lock:
    """현재 이벤트 루프에서 실제 다운로드를 하나씩 실행하는 잠금을 반환한다."""
    loop = asyncio.get_running_loop()
    execution_lock = _download_execution_locks.get(loop)
    if execution_lock is None:
        execution_lock = asyncio.Lock()
        _download_execution_locks[loop] = execution_lock
    return execution_lock


async def _download_with_rate_limit_retry(
    loop,
    ydl_opts: dict,
    url: str,
    download_id: str,
    logger,
) -> dict:
    """원본 서버의 429 응답만 정해진 간격으로 재시도한다."""
    retry_index = 0
    while True:
        try:
            return await loop.run_in_executor(
                None,
                lambda: _download_with_ydl(ydl_opts, url),
            )
        except Exception as error:
            if "429" not in str(error) or retry_index >= len(RATE_LIMIT_RETRY_DELAYS):
                raise

            delay = RATE_LIMIT_RETRY_DELAYS[retry_index]
            retry_index += 1
            download_status[download_id].update({
                'status': 'pending',
                'progress': 0.0,
                'error': f'원본 서버 요청 제한으로 {delay}초 후 재시도합니다.',
            })
            logger.warning(
                "Source rate limit for %s; retry %s/%s in %s seconds",
                download_id,
                retry_index,
                len(RATE_LIMIT_RETRY_DELAYS),
                delay,
            )
            await asyncio.sleep(delay)
            download_status[download_id].update({
                'status': 'downloading',
                'error': None,
            })


def _is_suspicious_requested_filename(requested_filename: str) -> bool:
    """URL 형태이거나 비정상적인 요청 파일명인지 검사한다."""
    trimmed = str(requested_filename).strip()
    if not trimmed:
        return True
    if trimmed.startswith(('http://', 'https://', 'rtmp://', 'blob:')) or '://' in trimmed:
        return True
    if 'watch?v=' in trimmed or 'watch_v=' in trimmed or trimmed.startswith('?'):
        return True
    if trimmed.lower() in ('videoplayback', 'playlist', 'manifest', 'video', 'audio', 'master'):
        return True
    if re.match(r'^[a-zA-Z0-9_-]{11}$', trimmed):
        return True
    return False


def _safe_output_filename(
    requested_filename: Optional[str],
    fallback_filename: str,
    extension: str,
) -> str:
    """요청 파일명을 단일 안전한 파일명으로 정리한다."""
    raw_name = requested_filename
    if not raw_name or _is_suspicious_requested_filename(raw_name):
        raw_name = fallback_filename

    basename = str(raw_name).replace('\\', '/').rsplit('/', 1)[-1]
    stem = Path(basename).stem if Path(basename).suffix else basename
    stem = re.sub(r'[/\\:*?"<>|]', '_', stem).strip(' ._')
    if not stem or _is_suspicious_requested_filename(stem):
        fallback_basename = str(fallback_filename).replace('\\', '/').rsplit('/', 1)[-1]
        stem = Path(fallback_basename).stem if Path(fallback_basename).suffix else fallback_basename
        stem = re.sub(r'[/\\:*?"<>|]', '_', stem).strip(' ._') or 'download'
    return f"{stem[:180]}{extension}"


def _available_output_path(
    output_dir: str,
    filename: str,
    download_id: str,
) -> Path:
    """기존 파일을 덮어쓰지 않는 최종 경로를 반환한다."""
    output_path = Path(output_dir) / filename
    if not output_path.exists():
        return output_path

    suffix = output_path.suffix
    stem = output_path.stem
    candidate = output_path.with_name(f"{stem} ({download_id[:8]}){suffix}")
    sequence = 2
    while candidate.exists():
        candidate = output_path.with_name(
            f"{stem} ({download_id[:8]}-{sequence}){suffix}"
        )
        sequence += 1
    return candidate


def _move_download_to_output(
    source_path: str,
    output_dir: str,
    requested_filename: Optional[str],
    download_id: str,
) -> str:
    """격리된 작업 파일과 썸네일을 사용자 다운로드 폴더로 이동한다."""
    source = Path(source_path)
    filename = _safe_output_filename(
        requested_filename,
        source.name,
        source.suffix,
    )
    destination = _available_output_path(output_dir, filename, download_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    source.replace(destination)

    source_stem = source.with_suffix('')
    for thumbnail_extension in ['.webp', '.jpg', '.jpeg', '.png', '.gif']:
        source_thumbnail = Path(f"{source_stem}{thumbnail_extension}")
        if not source_thumbnail.exists():
            continue
        destination_thumbnail = destination.with_suffix(thumbnail_extension)
        if destination_thumbnail.exists():
            destination_thumbnail = destination.with_name(
                f"{destination.stem}_{download_id[:8]}{thumbnail_extension}"
            )
        source_thumbnail.replace(destination_thumbnail)
        break

    return str(destination)


def _collect_download_outputs(
    staging_dir: str,
    preferred_filename: str,
    expected_extension: str,
) -> list[Path]:
    """완료된 실제 결과 파일을 주 결과부터 결정적인 순서로 반환한다."""
    staging_root = Path(staging_dir)
    expected_extension = expected_extension.lower()
    preferred_path = Path(preferred_filename)
    output_paths = sorted(
        path
        for path in staging_root.rglob('*')
        if path.is_file()
        and path.suffix.lower() in COMPLETED_DOWNLOAD_EXTENSIONS
    )

    if not output_paths:
        raise FileNotFoundError(
            '완료된 다운로드 결과 파일을 찾을 수 없습니다.'
        )

    output_paths.sort(
        key=lambda path: (
            path != preferred_path,
            path.suffix.lower() != expected_extension,
            str(path),
        )
    )

    return output_paths

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
    # 영상/오디오 다운로드 중 동반 자막 파일(.srt/.vtt 등)의 진행 이벤트는
    # 본 영상 완료 상태로 오인되지 않도록 무시한다.
    hook_filename = d.get('filename', '')
    hook_ext = Path(hook_filename).suffix.lower() if hook_filename else ''
    expected_file_type = download_status.get(download_id, {}).get('file_type')
    if expected_file_type in ('video', 'audio') and hook_ext in SUBTITLE_EXTENSIONS:
        return

    if d['status'] == 'downloading':
        downloaded = d.get('downloaded_bytes', 0)
        total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
        if total > 0:
            progress = (downloaded / total) * 100
            speed = d.get('speed', 0)
            eta = d.get('eta', 0)
            
            download_status[download_id] = {
                **download_status.get(download_id, {}),
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
    ws_manager = None,
    requested_filename: Optional[str] = None,
) -> dict:
    """Download video using yt-dlp"""
    from .database import User
    from .telegram.notifications import notification_manager
    from .path_helper import get_user_download_path
    import logging
    
    logger = logging.getLogger(__name__)
    print(f"[Download] Starting: {download_id} for user {user_id}")
    print(f"[Download] WebSocket manager available: {ws_manager is not None}")
    logger.info(f"Starting download: {download_id} for user {user_id}, URL: {url}, Resolution: {resolution}")
    logger.info(f"WebSocket manager: {ws_manager is not None}")

    staging_dir = None
    cleanup_staging = True

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
        
        # Get user-specific download path using path helper
        relative_download_path = get_user_download_path(db, user_id, username, url)
        user_download_dir = os.path.join(DOWNLOADS_DIR, relative_download_path)
        
        # Create directory with all parent directories
        Path(user_download_dir).mkdir(parents=True, exist_ok=True)

        # 동일한 제목을 반환하는 URL들도 서로 간섭하지 않도록 작업별로 격리한다.
        staging_dir = os.path.join(user_download_dir, '.vdtn-tmp', download_id)
        Path(staging_dir).mkdir(parents=True, exist_ok=True)

        # Parse resolution options
        options = parse_resolution(resolution)
        file_type = options.pop('file_type', 'video')
        download_status[download_id]['file_type'] = file_type

        # Get current event loop to pass to progress_hook
        loop = asyncio.get_event_loop()

        # Base yt-dlp options
        is_subtitle_only = file_type == 'subtitle'
        ydl_opts = {
            'outtmpl': os.path.join(staging_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, download_id, user_id, ws_manager, loop, notification_manager)],
            'writethumbnail': not is_subtitle_only,
            'embedthumbnail': not is_subtitle_only,
            'noplaylist': False,  # Allow playlist downloads
            'yes_playlist': True,  # Download entire playlist if URL is a playlist
            **options
        }

        # 사용자 계정에 자막 자동 동시 다운로드가 활성화된 경우 영상 다운로드에 자막 옵션을 함께 주입한다.
        if file_type == 'video' and user and getattr(user, 'auto_download_subtitles', 0):
            subtitle_langs = parse_subtitle_languages(
                getattr(user, 'subtitle_languages', 'ko,en')
            )
            if subtitle_langs:
                subtitle_fmt = normalize_subtitle_format(
                    getattr(user, 'subtitle_format', 'srt')
                )
                include_auto = bool(
                    1 if getattr(user, 'subtitle_include_auto', 1) is None else getattr(user, 'subtitle_include_auto', 1)
                )
                ydl_opts['writesubtitles'] = True
                ydl_opts['writeautomaticsub'] = include_auto
                ydl_opts['subtitleslangs'] = subtitle_langs
                ydl_opts['subtitlesformat'] = f'{subtitle_fmt}/vtt/srt/best'
                # 다중 언어 자막 요청 시 YouTube timedtext 429 제한을 완화하기 위해 요청 간 대기 시간 추가
                if len(subtitle_langs) > 1:
                    ydl_opts['sleep_interval_subtitles'] = 2
                postprocessors = list(ydl_opts.get('postprocessors', []))
                postprocessors.append({
                    'key': 'FFmpegSubtitlesConvertor',
                    'format': subtitle_fmt,
                })
                ydl_opts['postprocessors'] = postprocessors
                logger.info(
                    "Auto subtitle co-download enabled for user %s: langs=%s format=%s include_auto=%s",
                    user_id,
                    subtitle_langs,
                    subtitle_fmt,
                    include_auto,
                )
        
        # 프록시 설정 (WARP, SOCKS5, HTTP, VPN 등 모든 프록시 지원)
        proxy_url = os.getenv('PROXY')
        if proxy_url:
            ydl_opts['proxy'] = proxy_url
            print(f"[Download] Using proxy: {proxy_url}")
            logger.info(f"Using proxy for download: {proxy_url}")

        execution_lock = _get_download_execution_lock()
        async with execution_lock:
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

            # 실제 다운로드는 서버 프로세스에서 하나씩 실행한다.
            # 실행 스레드가 실패하거나 취소돼도 이미 완료된 파일은 보존한다.
            cleanup_staging = False
            result = await _download_with_rate_limit_retry(
                loop,
                ydl_opts,
                url,
                download_id,
                logger,
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
        
        output_paths = _collect_download_outputs(
            staging_dir,
            result['filename'],
            expected_extension,
        )
        non_subtitle_outputs = [
            path for path in output_paths
            if path.suffix.lower() not in SUBTITLE_EXTENSIONS
        ]
        is_single_media_with_subtitles = (
            len(non_subtitle_outputs) == 1
            and output_paths[0].suffix.lower() not in SUBTITLE_EXTENSIONS
        )

        moved_paths = []
        if is_single_media_with_subtitles:
            primary_source = output_paths[0]
            primary_moved = _move_download_to_output(
                str(primary_source),
                user_download_dir,
                requested_filename,
                download_id,
            )
            moved_paths.append(primary_moved)
            primary_dest_stem = Path(primary_moved).stem

            for companion_path in output_paths[1:]:
                if companion_path.suffix.lower() in SUBTITLE_EXTENSIONS:
                    companion_requested = build_companion_subtitle_filename(
                        companion_path.name,
                        primary_source.stem,
                        primary_dest_stem,
                    )
                else:
                    companion_requested = None
                moved_paths.append(
                    _move_download_to_output(
                        str(companion_path),
                        user_download_dir,
                        companion_requested,
                        download_id,
                    )
                )
        else:
            output_filename = requested_filename if len(output_paths) == 1 else None
            moved_paths = [
                _move_download_to_output(
                    str(output_path),
                    user_download_dir,
                    output_filename,
                    download_id,
                )
                for output_path in output_paths
            ]

        full_path = moved_paths[0]
        cleanup_staging = True
        result['filename'] = full_path
        
        relative_path = os.path.relpath(full_path, DOWNLOADS_DIR)
        file_extension = Path(full_path).suffix.lower()
        
        print(f"[Download] Final file path: {full_path}")
        print(f"[Download] Relative path: {relative_path}")
        print(f"[Download] Final extension: {file_extension}")
        
        actual_file_type = file_type
        
        # Override file type based on actual extension
        if file_extension in AUDIO_EXTENSIONS:
            actual_file_type = 'audio'
        elif file_extension in VIDEO_EXTENSIONS:
            actual_file_type = 'video'
        elif file_extension in SUBTITLE_EXTENSIONS:
            actual_file_type = 'subtitle'

        # 실제 디스크 크기를 우선 사용 (자막 전용 다운로드 시 filesize가 None인 문제 해결)
        actual_file_size = (
            os.path.getsize(full_path)
            if os.path.exists(full_path)
            else result.get('filesize')
        )
        
        # Check for existing file (for duplicate prevention)
        if actual_file_type == 'subtitle':
            existing_file = db.query(DownloadedFile).filter(
                DownloadedFile.filename == relative_path,
                DownloadedFile.user_id == user_id
            ).first()
            should_update = existing_file is not None
        else:
            existing_file = db.query(DownloadedFile).filter(
                DownloadedFile.original_url == url,
                DownloadedFile.user_id == user_id,
                DownloadedFile.file_type == actual_file_type
            ).first()
            should_update = False
            if existing_file:
                existing_ext = os.path.splitext(existing_file.filename)[1].lower()
                if existing_ext == file_extension:
                    should_update = True
                    print(f"[Download] Same extension detected, updating existing file: {existing_file.id}")
                else:
                    print(f"[Download] Different extension ({existing_ext} vs {file_extension}), creating new record")
        
        if actual_file_type == 'subtitle':
            thumbnail_value = None
            duration_value = None
            metadata = {}
        else:
            # Find local thumbnail file (yt-dlp saves it with same name as video)
            local_thumbnail = None
            video_stem = os.path.splitext(full_path)[0]
            thumbnail_extensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif']
            for thumb_ext in thumbnail_extensions:
                potential_thumb = video_stem + thumb_ext
                if os.path.exists(potential_thumb):
                    local_thumbnail = os.path.relpath(potential_thumb, DOWNLOADS_DIR)
                    print(f"[Download] Found local thumbnail: {local_thumbnail}")
                    break

            thumbnail_value = local_thumbnail if local_thumbnail else result.get('thumbnail')
            duration_value = _duration_in_seconds(result.get('duration'))
            metadata = result.get('metadata', {})

        # 사용자 계정에 '영상 설명 자동 저장'이 켜져 있는 경우 yt-dlp 표준 description을 memo 초기값으로 저장
        auto_memo_value = None
        if (
            actual_file_type != 'subtitle'
            and user
            and getattr(user, 'auto_save_description', 0)
            and result.get('description')
        ):
            normalized_desc = str(result.get('description')).strip()
            if normalized_desc:
                auto_memo_value = normalized_desc[:10000]
        
        # Update existing file or create new one
        if should_update:
            # Update existing record
            existing_file.filename = relative_path
            existing_file.file_type = actual_file_type
            existing_file.file_size = actual_file_size
            existing_file.thumbnail = thumbnail_value
            existing_file.duration = duration_value
            # Update metadata fields
            existing_file.resolution = metadata.get('resolution')
            existing_file.video_codec = metadata.get('video_codec')
            existing_file.audio_codec = metadata.get('audio_codec')
            existing_file.bitrate = metadata.get('bitrate')
            existing_file.framerate = metadata.get('framerate')
            # 사용자가 이미 직접 작성·편집한 메모가 있으면 덮어쓰지 않고 비어있을 때만 채운다.
            if auto_memo_value and not existing_file.memo:
                existing_file.memo = auto_memo_value
            file_info = existing_file
        else:
            # Create new record
            print(f"[Download] Creating new file record")
            file_info = DownloadedFile(
                filename=relative_path,
                original_url=url,
                file_type=actual_file_type,
                file_size=actual_file_size,
                thumbnail=thumbnail_value,
                duration=duration_value,
                resolution=metadata.get('resolution'),
                video_codec=metadata.get('video_codec'),
                audio_codec=metadata.get('audio_codec'),
                bitrate=metadata.get('bitrate'),
                framerate=metadata.get('framerate'),
                memo=auto_memo_value,
                user_id=user_id
            )
            db.add(file_info)

        # 함께 다운로드된 동반 자막 파일들을 라이브러리에 개별 등록한다.
        for companion_moved_path in moved_paths[1:]:
            companion_ext = Path(companion_moved_path).suffix.lower()
            if companion_ext not in SUBTITLE_EXTENSIONS:
                continue
            companion_relative = os.path.relpath(companion_moved_path, DOWNLOADS_DIR)
            companion_size = (
                os.path.getsize(companion_moved_path)
                if os.path.exists(companion_moved_path)
                else None
            )
            existing_subtitle = db.query(DownloadedFile).filter(
                DownloadedFile.filename == companion_relative,
                DownloadedFile.user_id == user_id
            ).first()
            if existing_subtitle:
                existing_subtitle.original_url = url
                existing_subtitle.file_type = 'subtitle'
                existing_subtitle.file_size = companion_size
                existing_subtitle.thumbnail = None
                existing_subtitle.duration = None
            else:
                db.add(DownloadedFile(
                    filename=companion_relative,
                    original_url=url,
                    file_type='subtitle',
                    file_size=companion_size,
                    thumbnail=None,
                    duration=None,
                    user_id=user_id
                ))
        
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
                    actual_file_size or 0
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
                    file_size=actual_file_size or 0,
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
    finally:
        if staging_dir and cleanup_staging:
            shutil.rmtree(staging_dir, ignore_errors=True)
            staging_root = Path(staging_dir).parent
            try:
                staging_root.rmdir()
            except OSError:
                pass

def _create_youtube_dl(ydl_opts: dict):
    """영상+자막 동시 다운로드 시 자막 실패(예: YouTube 429)로 영상 다운로드가 중단되지 않는 YoutubeDL 인스턴스를 생성한다."""
    base_cls = yt_dlp.YoutubeDL
    is_co_download = (
        not ydl_opts.get('skip_download')
        and (ydl_opts.get('writesubtitles') or ydl_opts.get('writeautomaticsub'))
    )
    if not is_co_download or not isinstance(base_cls, type):
        return base_cls(ydl_opts)

    class _ResilientSubtitleYoutubeDL(base_cls):
        def _write_subtitles(self, info_dict, filename):
            original_ignore = self.params.get('ignoreerrors', False)
            try:
                self.params['ignoreerrors'] = True
                return super()._write_subtitles(info_dict, filename)
            finally:
                self.params['ignoreerrors'] = original_ignore

    return _ResilientSubtitleYoutubeDL(ydl_opts)


def _download_with_ydl(ydl_opts: dict, url: str) -> dict:
    """Helper function to run yt-dlp download"""
    import os
    from pathlib import Path
    
    with _create_youtube_dl(ydl_opts) as ydl:
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
        
        # Extract metadata from yt-dlp info
        metadata = {}
        
        # Resolution
        if info.get('height'):
            metadata['resolution'] = f"{info.get('height')}p"
        
        # Video codec
        if info.get('vcodec') and info.get('vcodec') != 'none':
            vcodec = info.get('vcodec')
            # Simplify codec name (e.g., "avc1.640028" -> "h264")
            if 'avc' in vcodec.lower() or 'h264' in vcodec.lower():
                metadata['video_codec'] = 'h264'
            elif 'vp9' in vcodec.lower():
                metadata['video_codec'] = 'vp9'
            elif 'av01' in vcodec.lower() or 'av1' in vcodec.lower():
                metadata['video_codec'] = 'av1'
            elif 'hevc' in vcodec.lower() or 'h265' in vcodec.lower():
                metadata['video_codec'] = 'h265'
            else:
                metadata['video_codec'] = vcodec.split('.')[0]
        
        # Audio codec
        if info.get('acodec') and info.get('acodec') != 'none':
            acodec = info.get('acodec')
            # Simplify codec name
            if 'mp4a' in acodec.lower():
                metadata['audio_codec'] = 'aac'
            elif 'opus' in acodec.lower():
                metadata['audio_codec'] = 'opus'
            elif 'mp3' in acodec.lower():
                metadata['audio_codec'] = 'mp3'
            elif 'vorbis' in acodec.lower():
                metadata['audio_codec'] = 'vorbis'
            else:
                metadata['audio_codec'] = acodec.split('.')[0]
        
        # Bitrate (total bitrate in kbps)
        if info.get('tbr'):
            metadata['bitrate'] = f"{int(info.get('tbr'))}k"
        
        # Framerate
        if info.get('fps'):
            metadata['framerate'] = str(int(info.get('fps')))
        
        return {
            'filename': actual_filename,
            'filesize': filesize,
            'thumbnail': info.get('thumbnail'),
            'duration': info.get('duration'),
            'title': info.get('title'),
            'description': info.get('description'),
            'metadata': metadata
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
