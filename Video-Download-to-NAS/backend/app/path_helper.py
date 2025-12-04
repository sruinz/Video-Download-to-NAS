"""
폴더 구성 유틸리티 모듈

사용자의 폴더 구성 설정에 따라 다운로드 경로를 생성하는 유틸리티 함수들을 제공합니다.
"""

from datetime import datetime, timezone
from urllib.parse import urlparse
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
import re
import logging

logger = logging.getLogger(__name__)

# 지원되는 폴더 구성 모드
FOLDER_MODES = [
    'root',              # 루트 폴더에 저장 (username/)
    'date',              # 날짜 폴더 (username/2024-12-04/)
    'site_full',         # 전체 도메인 폴더 (username/example.com/)
    'site_name',         # 도메인명만 (username/example/)
    'date_site_full',    # 날짜 + 전체 도메인 (username/2024-12-04/example.com/)
    'date_site_name',    # 날짜 + 도메인명 (username/2024-12-04/example/)
    'site_full_date',    # 전체 도메인 + 날짜 (username/example.com/2024-12-04/)
    'site_name_date'     # 도메인명 + 날짜 (username/example/2024-12-04/)
]


def get_user_download_path(
    db: Session,
    user_id: int,
    username: str,
    download_url: str
) -> str:
    """
    사용자의 폴더 구성 설정에 따라 다운로드 경로를 생성합니다.
    
    Args:
        db: Database session
        user_id: User ID
        username: Username
        download_url: 다운로드 원본 URL
    
    Returns:
        상대 경로 (예: "username/youtube/2024-12-04")
    
    Examples:
        >>> get_user_download_path(db, 1, "user1", "https://youtube.com/watch?v=123")
        "user1/youtube.com/2024-12-04"
    """
    from .database import User
    
    # 사용자의 폴더 구성 모드 조회
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"User {user_id} not found, using root mode")
        return username
    
    mode = user.folder_organization_mode or 'root'
    
    # 모드에 따라 경로 구성
    if mode == 'root':
        return username
    
    elif mode == 'date':
        # 단일 레벨 날짜 폴더
        date_folder = get_date_folder()
        return f"{username}/{date_folder}"
    
    elif mode == 'site_full':
        domain = extract_domain(download_url, full_domain=True)
        if domain:
            return f"{username}/{domain}"
        return username
    
    elif mode == 'site_name':
        domain = extract_domain(download_url, full_domain=False)
        if domain:
            return f"{username}/{domain}"
        return username
    
    elif mode == 'date_site_full':
        # 날짜 + 전체 도메인
        domain = extract_domain(download_url, full_domain=True)
        date_folder = get_date_folder()
        if domain:
            return f"{username}/{date_folder}/{domain}"
        return f"{username}/{date_folder}"
    
    elif mode == 'date_site_name':
        # 날짜 + 도메인명
        domain = extract_domain(download_url, full_domain=False)
        date_folder = get_date_folder()
        if domain:
            return f"{username}/{date_folder}/{domain}"
        return f"{username}/{date_folder}"
    
    elif mode == 'site_full_date':
        # 전체 도메인 + 날짜
        domain = extract_domain(download_url, full_domain=True)
        date_folder = get_date_folder()
        if domain:
            return f"{username}/{domain}/{date_folder}"
        return f"{username}/{date_folder}"
    
    elif mode == 'site_name_date':
        # 도메인명 + 날짜
        domain = extract_domain(download_url, full_domain=False)
        date_folder = get_date_folder()
        if domain:
            return f"{username}/{domain}/{date_folder}"
        return f"{username}/{date_folder}"
    
    else:
        logger.warning(f"Unknown folder mode '{mode}' for user {user_id}, using root")
        return username


def extract_domain(url: str, full_domain: bool = True) -> Optional[str]:
    """
    URL에서 도메인을 추출합니다.
    
    Args:
        url: 원본 URL
        full_domain: True면 메인 도메인 + TLD (예: ruliweb.com), False면 도메인명만 (예: ruliweb)
    
    Returns:
        도메인 문자열 또는 None
    
    Examples:
        >>> extract_domain("https://www.youtube.com/watch?v=123", full_domain=True)
        "youtube.com"
        >>> extract_domain("https://i2.ruliweb.com/img/...", full_domain=True)
        "ruliweb.com"
        >>> extract_domain("https://www.youtube.com/watch?v=123", full_domain=False)
        "youtube"
        >>> extract_domain("https://i3.ruliweb.com/img/...", full_domain=False)
        "ruliweb"
        >>> extract_domain("invalid-url")
        None
    """
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc
        
        if not netloc:
            return None
        
        # www. 제거
        if netloc.startswith('www.'):
            netloc = netloc[4:]
        
        if not netloc:
            return None
        
        # 도메인 파싱: 서브도메인 제거하고 메인 도메인만 추출
        # 예: i2.ruliweb.com -> ruliweb.com
        # 예: youtube.com -> youtube.com
        # 예: www.example.co.kr -> example.co.kr
        parts = netloc.split('.')
        
        if len(parts) >= 2:
            # 마지막 두 부분을 메인 도메인으로 사용
            # i2.ruliweb.com -> ruliweb.com
            # youtube.com -> youtube.com
            main_domain = '.'.join(parts[-2:])
            
            # 폴더명으로 사용 가능하도록 정제
            main_domain = sanitize_folder_name(main_domain)
            
            if full_domain:
                # 전체 도메인 (메인 도메인 + TLD)
                return main_domain
            else:
                # 도메인명만 (TLD 제거)
                # ruliweb.com -> ruliweb
                domain_name = parts[-2]
                return sanitize_folder_name(domain_name)
        elif len(parts) > 0:
            # 단일 부분만 있는 경우
            sanitized = sanitize_folder_name(parts[0])
            return sanitized
        
        return None
    
    except Exception as e:
        logger.error(f"Failed to extract domain from URL '{url}': {e}")
        return None


def sanitize_folder_name(name: str) -> str:
    """
    폴더명에 사용할 수 없는 문자를 제거합니다.
    
    Linux/Windows에서 사용할 수 없는 문자: / \\ : * ? " < > |
    
    Args:
        name: 원본 폴더명
    
    Returns:
        정제된 폴더명
    
    Examples:
        >>> sanitize_folder_name("my:folder*name")
        "my_folder_name"
        >>> sanitize_folder_name("normal_folder")
        "normal_folder"
    """
    # 사용할 수 없는 문자를 언더스코어로 치환
    invalid_chars = r'[/\\:*?"<>|]'
    sanitized = re.sub(invalid_chars, '_', name)
    
    # 연속된 언더스코어를 하나로 축소
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # 앞뒤 공백 및 언더스코어 제거
    sanitized = sanitized.strip(' _')
    
    # 빈 문자열이면 기본값 반환
    if not sanitized:
        return 'unknown'
    
    return sanitized


def get_date_folder() -> str:
    """
    현재 날짜를 YYYY-MM-DD 형식으로 반환합니다.
    
    Docker 컨테이너의 TZ 환경변수(docker-compose.yml에서 설정)에 따라
    시스템 로컬 시간을 사용합니다. 기본값은 Asia/Seoul입니다.
    
    Returns:
        날짜 문자열 (예: "2024-12-04")
    
    Examples:
        >>> get_date_folder()
        "2024-12-04"
    """
    # 시스템의 로컬 시간 사용 (Docker TZ 환경변수 적용됨)
    # docker-compose.yml에서 TZ=Asia/Seoul로 설정되어 있음
    return datetime.now().strftime("%Y-%m-%d")
