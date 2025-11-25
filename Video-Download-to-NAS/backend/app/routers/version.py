"""
Version Router
버전 정보 및 업데이트 체크 API 엔드포인트
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from ..database import get_db
from ..auth import get_current_user
from ..database import User
from ..services.version_service import VersionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/version", tags=["version"])

# Version Service 인스턴스 (싱글톤)
version_service = VersionService()


@router.get("/current")
async def get_current_version():
    """현재 실행 중인 버전 반환 (인증 불필요)"""
    version = version_service.get_current_version()
    return {"version": version}


@router.get("/check")
async def check_for_updates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """업데이트 가능 여부 확인 (관리자만)"""
    # 관리자 권한 체크
    if current_user.role not in ['super_admin', 'admin']:
        return {
            "current_version": version_service.get_current_version(),
            "update_available": False,
            "message": "Admin only"
        }
    
    try:
        result = await version_service.check_for_updates()
        
        logger.info(
            f"Version check by {current_user.username}: "
            f"current_version={result['current_version']}, "
            f"build_time={result['build_time']}, "
            f"dockerhub_time={result['dockerhub_update_time']}, "
            f"update_available={result['update_available']}"
        )
        
        return result
    except Exception as e:
        logger.error(f"Version check failed: {e}")
        # 에러 시에도 현재 버전은 반환
        return {
            "current_version": version_service.get_current_version(),
            "build_time": None,
            "dockerhub_update_time": None,
            "update_available": False,
            "last_checked": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }
