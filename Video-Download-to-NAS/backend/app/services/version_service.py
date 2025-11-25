"""
Version Service
Docker Hub API를 통해 새로운 이미지를 감지하고 버전 정보를 제공하는 서비스
"""
import os
import json
import aiohttp
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class VersionService:
    """버전 체크 및 Docker Hub API 연동 서비스"""
    
    def __init__(self):
        # Docker Hub 이미지 이름 (하드코딩 - 변경 불필요)
        self.docker_image = "sruinz/vdtnsvr-backend"
        self.cache = {}
        self.cache_duration = timedelta(hours=1)
        
    def get_current_version(self) -> str:
        """VERSION 파일 또는 __init__.py에서 현재 버전 읽기"""
        try:
            # 1. VERSION 파일에서 읽기 (빌드 시 복사됨)
            version_path = "/app/VERSION"
            if os.path.exists(version_path):
                with open(version_path, 'r') as f:
                    version = f.read().strip()
                    if version:
                        return version
            
            # 2. __init__.py에서 읽기 (update_version.sh로 업데이트됨)
            try:
                from .. import __version__
                if __version__ and __version__ != 'unknown':
                    return __version__
            except:
                pass
            
            # 3. 기본값
            return 'unknown'
        except Exception as e:
            logger.error(f"Failed to get current version: {e}")
            return 'unknown'
    
    def get_build_time(self) -> Optional[datetime]:
        """BUILD_TIME 파일에서 빌드 시간 읽기"""
        try:
            # 테스트 모드: 환경 변수로 빌드 시간 오버라이드
            test_build_time = os.getenv('TEST_BUILD_TIME')
            if test_build_time:
                logger.info(f"Using TEST_BUILD_TIME: {test_build_time}")
                return datetime.fromisoformat(test_build_time.replace('Z', '+00:00'))
            
            # 일반 모드: BUILD_TIME 파일에서 읽기
            build_time_path = "/app/BUILD_TIME"
            if os.path.exists(build_time_path):
                with open(build_time_path, 'r') as f:
                    timestamp_str = f.read().strip()
                    if timestamp_str:
                        # ISO 8601 형식으로 저장된 시간 파싱
                        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return None
        except Exception as e:
            logger.error(f"Failed to get build time: {e}")
            return None
    
    async def get_dockerhub_latest_update_time(self) -> Optional[datetime]:
        """Docker Hub API로 latest 태그의 마지막 업데이트 시간 조회"""
        try:
            # Docker Hub API v2 - 태그 정보 조회
            url = f"https://hub.docker.com/v2/repositories/{self.docker_image}/tags/latest"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # last_updated 필드에서 시간 추출
                        last_updated_str = data.get('last_updated')
                        if last_updated_str:
                            # ISO 8601 형식 파싱
                            last_updated = datetime.fromisoformat(last_updated_str.replace('Z', '+00:00'))
                            logger.debug(f"Docker Hub latest update time: {last_updated.isoformat()}")
                            return last_updated
                    else:
                        logger.warning(f"Docker Hub API returned status {response.status}")
            
            return None
        except asyncio.TimeoutError:
            logger.error("Docker Hub API timeout")
            return None
        except Exception as e:
            logger.error(f"Failed to get Docker Hub update time: {e}")
            return None
    
    async def check_for_updates(self) -> Dict:
        """업데이트 확인 - 날짜 기반 비교 (일 단위)"""
        cache_key = "version_check"
        now = datetime.now(timezone.utc)
        
        # 캐시 확인
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if now - cached_time < self.cache_duration:
                logger.debug("Using cached version check result")
                return cached_data
        
        # 현재 버전 및 빌드 시간 정보
        current_version = self.get_current_version()
        build_time = self.get_build_time()
        
        # Docker Hub에서 최신 업데이트 시간 조회
        dockerhub_update_time = await self.get_dockerhub_latest_update_time()
        
        # 날짜만 비교 (일 단위)
        update_available = False
        if build_time and dockerhub_update_time:
            # 날짜만 추출 (시간 무시)
            build_date = build_time.date()
            dockerhub_date = dockerhub_update_time.date()
            
            # Docker Hub 날짜가 빌드 날짜보다 최신이면 업데이트 있음
            update_available = dockerhub_date > build_date
            
            logger.debug(
                f"Date comparison: "
                f"build_date={build_date}, "
                f"dockerhub_date={dockerhub_date}, "
                f"update_available={update_available}"
            )
        
        result = {
            "current_version": current_version,
            "build_time": build_time.isoformat() if build_time else None,
            "dockerhub_update_time": dockerhub_update_time.isoformat() if dockerhub_update_time else None,
            "update_available": update_available,
            "last_checked": now.isoformat()
        }
        
        # 캐시 저장
        self.cache[cache_key] = (result, now)
        
        logger.info(
            f"Version check completed: "
            f"update_available={update_available}, "
            f"current_version={current_version}, "
            f"build_date={build_time.date() if build_time else 'unknown'}, "
            f"dockerhub_date={dockerhub_update_time.date() if dockerhub_update_time else 'N/A'}"
        )
        
        return result
