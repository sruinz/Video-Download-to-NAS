"""
Video metadata extraction utilities using ffprobe
"""
import subprocess
import json
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


def extract_metadata_from_file(file_path: str) -> Dict[str, Optional[str]]:
    """
    Extract video metadata using ffprobe
    
    Args:
        file_path: Absolute path to video file
        
    Returns:
        Dictionary with metadata:
        - resolution: "1080p", "720p", etc.
        - video_codec: "h264", "vp9", etc.
        - audio_codec: "aac", "opus", etc.
        - bitrate: "2500k", "5000k", etc.
        - framerate: "30", "60", etc.
    """
    metadata = {
        'resolution': None,
        'video_codec': None,
        'audio_codec': None,
        'bitrate': None,
        'framerate': None
    }
    
    try:
        # Run ffprobe to get stream info
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            file_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10  # 10초 타임아웃
        )
        
        if result.returncode != 0:
            logger.warning(f"ffprobe failed for {file_path}: {result.stderr}")
            return metadata
        
        # Parse JSON output
        data = json.loads(result.stdout)
        streams = data.get('streams', [])
        format_info = data.get('format', {})
        
        # Extract video stream info
        video_stream = next((s for s in streams if s.get('codec_type') == 'video'), None)
        if video_stream:
            # Resolution - use the smaller dimension (for vertical videos)
            width = video_stream.get('width')
            height = video_stream.get('height')
            if width and height:
                # Use the smaller dimension to get the correct resolution
                # 1920x1080 (landscape) -> 1080p
                # 1080x1920 (portrait) -> 1080p
                resolution_value = min(width, height)
                metadata['resolution'] = f"{resolution_value}p"
            elif height:
                # Fallback to height only if width is not available
                metadata['resolution'] = f"{height}p"
            
            # Video codec
            codec_name = video_stream.get('codec_name', '')
            if codec_name:
                # Simplify codec names
                if codec_name in ['h264', 'avc']:
                    metadata['video_codec'] = 'h264'
                elif codec_name == 'vp9':
                    metadata['video_codec'] = 'vp9'
                elif codec_name in ['av1', 'av01']:
                    metadata['video_codec'] = 'av1'
                elif codec_name == 'hevc':
                    metadata['video_codec'] = 'h265'
                else:
                    metadata['video_codec'] = codec_name
            
            # Framerate
            fps_str = video_stream.get('r_frame_rate', '')
            if fps_str and '/' in fps_str:
                try:
                    num, den = map(int, fps_str.split('/'))
                    if den > 0:
                        fps = int(num / den)
                        metadata['framerate'] = str(fps)
                except:
                    pass
        
        # Extract audio stream info
        audio_stream = next((s for s in streams if s.get('codec_type') == 'audio'), None)
        if audio_stream:
            codec_name = audio_stream.get('codec_name', '')
            if codec_name:
                # Simplify codec names
                if codec_name in ['aac', 'mp4a']:
                    metadata['audio_codec'] = 'aac'
                elif codec_name == 'opus':
                    metadata['audio_codec'] = 'opus'
                elif codec_name in ['mp3', 'mp2']:
                    metadata['audio_codec'] = 'mp3'
                elif codec_name == 'vorbis':
                    metadata['audio_codec'] = 'vorbis'
                else:
                    metadata['audio_codec'] = codec_name
        
        # Bitrate (from format info)
        bit_rate = format_info.get('bit_rate')
        if bit_rate:
            try:
                bitrate_kbps = int(bit_rate) // 1000
                metadata['bitrate'] = f"{bitrate_kbps}k"
            except:
                pass
        
        return metadata
        
    except subprocess.TimeoutExpired:
        logger.error(f"ffprobe timeout for {file_path}")
        return metadata
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse ffprobe output for {file_path}: {e}")
        return metadata
    except Exception as e:
        logger.error(f"Unexpected error extracting metadata from {file_path}: {e}")
        return metadata
