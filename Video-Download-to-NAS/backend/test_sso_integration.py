#!/usr/bin/env python3
"""
SSO 통합 테스트

이 모듈은 SSO 인증의 전체 플로우를 테스트합니다:
- 전체 SSO 로그인 플로우 테스트
- 계정 연동 플로우 테스트
- CSRF 공격 방지 테스트

요구사항: 1.1, 1.2, 1.3, 6.1, 6.2, 8.1, 8.2
"""

import os
import sys
from pathlib import Path
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set test environment variables
os.environ["SSO_ENCRYPTION_KEY"] = "test-key-for-testing-only-not-secure-1234567890abcdef"
os.environ["DATABASE_URL"] = "sqlite:///./test_sso_integration.db"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-testing-only"
os.environ["FRONTEND_URL"] = "http://localhost:3000"

from app.main import app
from app.database import Base, engine, SessionLocal, User, SSOSettings, SystemSetting, SSOState
from app.auth import get_password_hash, create_access_token
from app.sso.security import encrypt_client_secret


@pytest.fixture(scope="module")
def setup_database():
    """테스트 데이터베이스 설정"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 기본 시스템 설정
        default_settings = {
            'allow_registration': 'true',
            'default_user_role': 'user',
            'default_user_quota_gb': '1',
            'admin_quota_gb': '10',
        }
        
        for key, value in default_settings.items():
            setting = SystemSetting(key=key, value=value)
            db.add(setting)
        
        # SSO 제공자 설정
        google_settings = SSOSettings(
            provider="google",
            provider_type="oauth2",
            enabled=1,
            client_id="test-google-client-id",
            client_secret_encrypted=encrypt_client_secret("test-google-secret"),
            redirect_uri="http://localhost:8000/api/sso/google/callback",
            scopes="openid email profile",
            display_name="Google"
        )
        db.add(google_settings)
        
        microsoft_settings = SSOSettings(
            provider="microsoft",
            provider_type="oauth2",
            enabled=1,
            client_id="test-microsoft-client-id",
            client_secret_encrypted=encrypt_client_secret("test-microsoft-secret"),
            redirect_uri="http://localhost:8000/api/sso/microsoft/callback",
            scopes="openid email profile User.Read",
            display_name="Microsoft"
        )
        db.add(microsoft_settings)
        
        github_settings = SSOSettings(
            provider="github",
            provider_type="oauth2",
            enabled=1,
            client_id="test-github-client-id",
            client_secret_encrypted=encrypt_client_secret("test-github-secret"),
            redirect_uri="http://localhost:8000/api/sso/github/callback",
            scopes="read:user user:email",
            display_name="GitHub"
        )
        db.add(github_settings)
        
        db.commit()
    finally:
        db.close()
    
    yield
    
    # 테스트 후 정리
    test_db_path = Path("./test_sso_integration.db")
    if test_db_path.exists():
        test_db_path.unlink()


@pytest.fixture
def client(setup_database):
    """FastAPI 테스트 클라이언트"""
    return TestClient(app)


@pytest.fixture
def db_session():
    """각 테스트마다 새로운 DB 세션 제공"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestSSOLoginFlow:
    """SSO 로그인 플로우 테스트 (요구사항 1.1, 1.2, 1.3)"""
    
    def test_get_enabled_providers(self, client):
        """활성화된 SSO 제공자 목록 조회"""
        response = client.get("/api/sso/providers")
        
        assert response.status_code == 200
        providers = response.json()
        
        # 활성화된 제공자들이 반환되어야 함
        assert len(providers) >= 3
        provider_names = [p["provider"] for p in providers]
        assert "google" in provider_names
        assert "microsoft" in provider_names
        assert "github" in provider_names
    
    def test_sso_login_initiation(self, client):
        """SSO 로그인 시작 - 인증 URL로 리다이렉트"""
        response = client.get("/api/sso/google/login", follow_redirects=False)
        
        assert response.status_code == 302
        
        # 리다이렉트 URL 확인
        redirect_url = response.headers["location"]
        assert "accounts.google.com" in redirect_url
        assert "oauth2" in redirect_url
        assert "state=" in redirect_url
        assert "client_id=" in redirect_url
    
    def test_sso_login_with_disabled_provider(self, client, db_session):
        """비활성화된 제공자로 로그인 시도 시 에러"""
        # GitHub 비활성화
        github_settings = db_session.query(SSOSettings).filter(
            SSOSettings.provider == "github"
        ).first()
        github_settings.enabled = 0
        db_session.commit()
        
        response = client.get("/api/sso/github/login", follow_redirects=False)
        
        assert response.status_code == 503
        
        # 다시 활성화
        github_settings.enabled = 1
        db_session.commit()
    
    def test_sso_login_with_unknown_provider(self, client):
        """존재하지 않는 제공자로 로그인 시도 시 에러"""
        response = client.get("/api/sso/unknown/login", follow_redirects=False)
        
        assert response.status_code == 404
    
    @patch("app.routers.sso.GoogleProvider")
    def test_sso_callback_success(self, mock_provider_class, client, db_session):
        """SSO 콜백 성공 - 사용자 생성 및 JWT 발급"""
        # Mock provider
        mock_provider = MagicMock()
        mock_provider.exchange_code_for_token = AsyncMock(return_value="mock-access-token")
        mock_provider.get_user_info = AsyncMock(return_value={
            "email": "newuser@gmail.com",
            "name": "New User",
            "id": "google-new-123",
            "verified_email": True
        })
        mock_provider_class.return_value = mock_provider
        
        # State 생성
        from app.sso.security import generate_state
        state = generate_state(db_session, "google")
        
        # 콜백 호출
        response = client.get(
            f"/api/sso/google/callback?code=test-code&state={state}",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        
        # 프론트엔드로 리다이렉트되어야 함
        redirect_url = response.headers["location"]
        assert "localhost:3000" in redirect_url
        assert "token=" in redirect_url
        
        # 사용자가 생성되었는지 확인
        user = db_session.query(User).filter(User.email == "newuser@gmail.com").first()
        assert user is not None
        assert user.auth_provider == "google"
        assert user.external_id == "google-new-123"
    
    def test_sso_callback_with_invalid_state(self, client):
        """잘못된 State로 콜백 시 에러 (CSRF 방지)"""
        response = client.get(
            "/api/sso/google/callback?code=test-code&state=invalid-state-12345",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        
        # 에러와 함께 프론트엔드로 리다이렉트
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_sso_callback_without_code(self, client, db_session):
        """Authorization code 없이 콜백 시 에러"""
        from app.sso.security import generate_state
        state = generate_state(db_session, "google")
        
        response = client.get(
            f"/api/sso/google/callback?state={state}",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_sso_callback_with_oauth_error(self, client):
        """OAuth2 제공자에서 에러 반환 시 처리"""
        response = client.get(
            "/api/sso/google/callback?error=access_denied&error_description=User+denied+access",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url


class TestAccountLinkingFlow:
    """계정 연동 플로우 테스트 (요구사항 6.1, 6.2)"""
    
    def test_link_sso_to_existing_account(self, client, db_session):
        """기존 계정에 SSO 제공자 연동"""
        # 로컬 사용자 생성
        user = User(
            username="linkuser",
            email="linkuser@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # JWT 토큰 생성
        token = create_access_token({"sub": user.username, "user_id": user.id})
        
        # SSO 연동 시작
        response = client.post(
            "/api/sso/google/link",
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=False
        )
        
        assert response.status_code == 302
        
        # 인증 URL로 리다이렉트되어야 함
        redirect_url = response.headers["location"]
        assert "accounts.google.com" in redirect_url
        assert "state=" in redirect_url
    
    def test_link_requires_authentication(self, client):
        """인증 없이 연동 시도 시 에러"""
        response = client.post("/api/sso/google/link", follow_redirects=False)
        
        assert response.status_code == 401
    
    def test_unlink_sso_provider(self, client, db_session):
        """SSO 제공자 연동 해제"""
        # SSO 사용자 생성
        user = User(
            username="unlinkuser",
            email="unlinkuser@example.com",
            hashed_password=get_password_hash("random-hash"),
            role="user",
            storage_quota_gb=1,
            auth_provider="google",
            external_id="google-unlink-123"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # JWT 토큰 생성
        token = create_access_token({"sub": user.username, "user_id": user.id})
        
        # SSO 연동 해제
        response = client.delete(
            "/api/sso/google/unlink",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        
        # 사용자 정보 확인
        db_session.refresh(user)
        assert user.auth_provider == "local"
        assert user.external_id is None
    
    def test_unlink_requires_authentication(self, client):
        """인증 없이 연동 해제 시도 시 에러"""
        response = client.delete("/api/sso/google/unlink")
        
        assert response.status_code == 401


class TestCSRFProtection:
    """CSRF 공격 방지 테스트 (요구사항 8.1, 8.2)"""
    
    def test_state_parameter_is_required(self, client):
        """State 파라미터 없이 콜백 시 에러"""
        response = client.get(
            "/api/sso/google/callback?code=test-code",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_state_parameter_must_be_valid(self, client):
        """State 파라미터가 유효하지 않으면 에러"""
        response = client.get(
            "/api/sso/google/callback?code=test-code&state=fake-state-12345",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_state_cannot_be_reused(self, client, db_session):
        """State는 일회용 - 재사용 불가"""
        from app.sso.security import generate_state
        state = generate_state(db_session, "google")
        
        # 첫 번째 사용 (실패하더라도 state는 소비됨)
        client.get(
            f"/api/sso/google/callback?code=test-code&state={state}",
            follow_redirects=False
        )
        
        # 두 번째 사용 시도 - 실패해야 함
        response = client.get(
            f"/api/sso/google/callback?code=test-code&state={state}",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_state_must_match_provider(self, client, db_session):
        """State는 생성된 제공자와 일치해야 함"""
        from app.sso.security import generate_state
        
        # Google용 state 생성
        state = generate_state(db_session, "google")
        
        # Microsoft 콜백에서 사용 시도 - 실패해야 함
        response = client.get(
            f"/api/sso/microsoft/callback?code=test-code&state={state}",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
    
    def test_expired_state_is_rejected(self, client, db_session):
        """만료된 State는 거부되어야 함"""
        from datetime import datetime, timedelta
        
        # 만료된 state 수동 생성
        expired_state = SSOState(
            state="expired-state-test-12345",
            provider="google",
            user_id=None,
            expires_at=datetime.now() - timedelta(minutes=5)
        )
        db_session.add(expired_state)
        db_session.commit()
        
        # 만료된 state로 콜백 시도
        response = client.get(
            "/api/sso/google/callback?code=test-code&state=expired-state-test-12345",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url


class TestRegistrationControl:
    """등록 제어 테스트"""
    
    @patch("app.routers.sso.GoogleProvider")
    def test_new_user_blocked_when_registration_disabled(
        self, mock_provider_class, client, db_session
    ):
        """등록이 비활성화되면 신규 사용자 생성 불가"""
        # 등록 비활성화
        setting = db_session.query(SystemSetting).filter(
            SystemSetting.key == "allow_registration"
        ).first()
        setting.value = "false"
        db_session.commit()
        
        # Mock provider
        mock_provider = MagicMock()
        mock_provider.exchange_code_for_token = AsyncMock(return_value="mock-token")
        mock_provider.get_user_info = AsyncMock(return_value={
            "email": "blocked@gmail.com",
            "name": "Blocked User",
            "id": "google-blocked-123",
            "verified_email": True
        })
        mock_provider_class.return_value = mock_provider
        
        # State 생성
        from app.sso.security import generate_state
        state = generate_state(db_session, "google")
        
        # 콜백 호출
        response = client.get(
            f"/api/sso/google/callback?code=test-code&state={state}",
            follow_redirects=False
        )
        
        assert response.status_code == 302
        redirect_url = response.headers["location"]
        assert "error=" in redirect_url
        
        # 사용자가 생성되지 않았는지 확인
        user = db_session.query(User).filter(User.email == "blocked@gmail.com").first()
        assert user is None
        
        # 등록 다시 활성화
        setting.value = "true"
        db_session.commit()


def run_tests():
    """테스트 실행"""
    import sys
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    print("=" * 60)
    print("SSO 통합 테스트")
    print("=" * 60)
    run_tests()
