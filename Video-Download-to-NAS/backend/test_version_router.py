"""
Version Router 테스트
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone
from app.main import app
from app.database import User


client = TestClient(app)


@pytest.fixture
def mock_version_service():
    """Mock Version Service"""
    with patch('app.routers.version.version_service') as mock:
        yield mock


@pytest.fixture
def admin_token():
    """관리자 토큰 생성"""
    # 실제 구현에서는 JWT 토큰 생성
    return "admin_token"


@pytest.fixture
def user_token():
    """일반 사용자 토큰 생성"""
    return "user_token"


class TestVersionRouter:
    """Version Router 테스트"""
    
    def test_get_current_version_no_auth(self, mock_version_service):
        """인증 없이 현재 버전 조회"""
        mock_version_service.get_current_version.return_value = "v1.2.3"
        
        response = client.get("/api/version/current")
        
        assert response.status_code == 200
        assert response.json() == {"version": "v1.2.3"}
    
    def test_check_for_updates_admin_success(self, mock_version_service):
        """관리자 권한으로 업데이트 체크 성공"""
        mock_admin = User(
            id=1,
            username="admin",
            email="admin@test.com",
            role="admin"
        )
        
        mock_result = {
            "current_version": "v1.0.0",
            "current_digest": "sha256:abc123",
            "latest_digest": "sha256:def456",
            "update_available": True,
            "last_checked": datetime.now(timezone.utc)
        }
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        mock_version_service.check_for_updates = AsyncMock(return_value=mock_result)
        
        with patch('app.routers.version.get_current_user', return_value=mock_admin):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["current_version"] == "v1.0.0"
            assert data["update_available"] is True
    
    def test_check_for_updates_super_admin_success(self, mock_version_service):
        """슈퍼 관리자 권한으로 업데이트 체크 성공"""
        mock_super_admin = User(
            id=1,
            username="superadmin",
            email="superadmin@test.com",
            role="super_admin"
        )
        
        mock_result = {
            "current_version": "v1.0.0",
            "current_digest": "sha256:abc123",
            "latest_digest": "sha256:def456",
            "update_available": True,
            "last_checked": datetime.now(timezone.utc)
        }
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        mock_version_service.check_for_updates = AsyncMock(return_value=mock_result)
        
        with patch('app.routers.version.get_current_user', return_value=mock_super_admin):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["update_available"] is True
    
    def test_check_for_updates_regular_user_denied(self, mock_version_service):
        """일반 사용자 권한으로 업데이트 체크 거부"""
        mock_user = User(
            id=2,
            username="user",
            email="user@test.com",
            role="user"
        )
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        
        with patch('app.routers.version.get_current_user', return_value=mock_user):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["update_available"] is False
            assert data["message"] == "Admin only"
    
    def test_check_for_updates_guest_denied(self, mock_version_service):
        """게스트 권한으로 업데이트 체크 거부"""
        mock_guest = User(
            id=3,
            username="guest",
            email="guest@test.com",
            role="guest"
        )
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        
        with patch('app.routers.version.get_current_user', return_value=mock_guest):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["update_available"] is False
            assert data["message"] == "Admin only"
    
    def test_check_for_updates_error_handling(self, mock_version_service):
        """업데이트 체크 에러 처리"""
        mock_admin = User(
            id=1,
            username="admin",
            email="admin@test.com",
            role="admin"
        )
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        mock_version_service.check_for_updates = AsyncMock(side_effect=Exception("API Error"))
        
        with patch('app.routers.version.get_current_user', return_value=mock_admin):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["current_version"] == "v1.0.0"
            assert data["update_available"] is False
            assert "error" in data
    
    def test_check_for_updates_no_update_available(self, mock_version_service):
        """업데이트 없음 시나리오"""
        mock_admin = User(
            id=1,
            username="admin",
            email="admin@test.com",
            role="admin"
        )
        
        mock_result = {
            "current_version": "v1.0.0",
            "current_digest": "sha256:abc123",
            "latest_digest": "sha256:abc123",
            "update_available": False,
            "last_checked": datetime.now(timezone.utc)
        }
        
        mock_version_service.get_current_version.return_value = "v1.0.0"
        mock_version_service.check_for_updates = AsyncMock(return_value=mock_result)
        
        with patch('app.routers.version.get_current_user', return_value=mock_admin):
            response = client.get("/api/version/check")
            
            assert response.status_code == 200
            data = response.json()
            assert data["update_available"] is False
            assert data["current_digest"] == data["latest_digest"]
