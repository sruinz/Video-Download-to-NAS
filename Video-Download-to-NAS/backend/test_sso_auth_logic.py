#!/usr/bin/env python3
"""
SSO 인증 로직 테스트

이 모듈은 SSO 인증의 핵심 로직을 테스트합니다:
- 사용자 생성 테스트
- 계정 연동 테스트  
- State 검증 테스트

요구사항: 5.1, 6.1, 8.1, 8.2
"""

import os
import sys
from pathlib import Path
import pytest
from datetime import datetime, timedelta

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set test environment variables
os.environ["SSO_ENCRYPTION_KEY"] = "test-key-for-testing-only-not-secure-1234567890abcdef"
os.environ["DATABASE_URL"] = "sqlite:///./test_sso_auth_logic.db"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-testing-only"

from app.sso.user_management import (
    create_or_get_user_from_sso,
    link_sso_to_user,
    create_access_token_with_sso
)
from app.sso.security import generate_state, verify_state, cleanup_expired_states
from app.database import init_db, SessionLocal, Base, engine, User, SystemSetting, SSOState
from app.auth import get_password_hash, verify_token


@pytest.fixture(scope="module")
def setup_database():
    """테스트 데이터베이스 설정"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 기본 설정 추가
        default_settings = {
            'allow_registration': 'true',
            'default_user_role': 'user',
            'default_user_quota_gb': '1',
            'admin_quota_gb': '10',
        }
        
        for key, value in default_settings.items():
            setting = SystemSetting(key=key, value=value)
            db.add(setting)
        
        db.commit()
    finally:
        db.close()
    
    yield
    
    # 테스트 후 정리
    test_db_path = Path("./test_sso_auth_logic.db")
    if test_db_path.exists():
        test_db_path.unlink()


@pytest.fixture
def db_session():
    """각 테스트마다 새로운 DB 세션 제공"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestUserCreation:
    """사용자 생성 테스트 (요구사항 5.1)"""
    
    def test_create_first_user_as_super_admin(self, setup_database, db_session):
        """첫 번째 사용자는 super_admin 역할을 받아야 함"""
        user_info = {
            "email": "first@example.com",
            "name": "First User",
            "verified_email": True
        }
        
        user = create_or_get_user_from_sso(
            db=db_session,
            provider="google",
            external_id="google-first-123",
            user_info=user_info
        )
        
        assert user.role == "super_admin"
        assert user.storage_quota_gb == 100
        assert user.auth_provider == "google"
        assert user.external_id == "google-first-123"
        assert user.email_verified == 1
        assert user.can_download_to_nas == 1
    
    def test_create_second_user_with_default_role(self, setup_database, db_session):
        """두 번째 사용자는 기본 역할을 받아야 함"""
        user_info = {
            "email": "second@example.com",
            "name": "Second User",
            "verified_email": False
        }
        
        user = create_or_get_user_from_sso(
            db=db_session,
            provider="microsoft",
            external_id="ms-second-456",
            user_info=user_info
        )
        
        assert user.role == "user"
        assert user.storage_quota_gb == 1
        assert user.auth_provider == "microsoft"
        assert user.email_verified == 0
    
    def test_get_existing_user_by_provider_and_external_id(self, setup_database, db_session):
        """기존 사용자를 provider와 external_id로 조회"""
        user_info = {
            "email": "first@example.com",
            "name": "First User",
            "verified_email": True
        }
        
        # 같은 provider와 external_id로 다시 호출
        user = create_or_get_user_from_sso(
            db=db_session,
            provider="google",
            external_id="google-first-123",
            user_info=user_info
        )
        
        # 새 사용자가 생성되지 않고 기존 사용자 반환
        assert user.role == "super_admin"
        assert user.email == "first@example.com"
        
        # 전체 사용자 수 확인
        user_count = db_session.query(User).count()
        assert user_count == 2  # first와 second만
    
    def test_link_existing_local_user_by_email(self, setup_database, db_session):
        """이메일이 일치하는 로컬 사용자에 SSO 연동"""
        # 로컬 사용자 생성
        local_user = User(
            username="localuser",
            email="local@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db_session.add(local_user)
        db_session.commit()
        db_session.refresh(local_user)
        
        # 같은 이메일로 SSO 로그인 시도
        user_info = {
            "email": "local@example.com",
            "name": "Local User",
            "verified_email": True
        }
        
        user = create_or_get_user_from_sso(
            db=db_session,
            provider="github",
            external_id="gh-local-789",
            user_info=user_info
        )
        
        # 같은 사용자여야 함
        assert user.id == local_user.id
        assert user.auth_provider == "github"
        assert user.external_id == "gh-local-789"
        assert user.email_verified == 1
    
    def test_registration_disabled_prevents_new_user(self, setup_database, db_session):
        """등록이 비활성화되면 신규 사용자 생성 불가"""
        # 등록 비활성화
        setting = db_session.query(SystemSetting).filter(
            SystemSetting.key == "allow_registration"
        ).first()
        setting.value = "false"
        db_session.commit()
        
        user_info = {
            "email": "newuser@example.com",
            "name": "New User",
            "verified_email": True
        }
        
        # 신규 사용자 생성 시도
        with pytest.raises(Exception) as exc_info:
            create_or_get_user_from_sso(
                db=db_session,
                provider="google",
                external_id="google-new-999",
                user_info=user_info
            )
        
        assert "registration" in str(exc_info.value).lower() or "disabled" in str(exc_info.value).lower()
        
        # 등록 다시 활성화
        setting.value = "true"
        db_session.commit()


class TestAccountLinking:
    """계정 연동 테스트 (요구사항 6.1)"""
    
    def test_link_sso_to_existing_user(self, setup_database, db_session):
        """기존 사용자에 SSO 제공자 연동"""
        # 사용자 생성
        user = User(
            username="linktest",
            email="linktest@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # SSO 연동
        linked_user = link_sso_to_user(
            db=db_session,
            user=user,
            provider="google",
            external_id="google-link-123",
            sso_email="linktest@example.com"
        )
        
        assert linked_user.auth_provider == "google"
        assert linked_user.external_id == "google-link-123"
        assert linked_user.email_verified == 1
    
    def test_link_fails_with_email_mismatch(self, setup_database, db_session):
        """이메일이 일치하지 않으면 연동 실패"""
        # 사용자 생성
        user = User(
            username="mismatchtest",
            email="correct@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # 다른 이메일로 연동 시도
        with pytest.raises(ValueError) as exc_info:
            link_sso_to_user(
                db=db_session,
                user=user,
                provider="google",
                external_id="google-mismatch-456",
                sso_email="wrong@example.com"
            )
        
        assert "mismatch" in str(exc_info.value).lower()
    
    def test_already_linked_user_can_be_updated(self, setup_database, db_session):
        """이미 연동된 사용자도 다른 제공자로 변경 가능"""
        # SSO 사용자 생성
        user = User(
            username="ssouser",
            email="ssouser@example.com",
            hashed_password=get_password_hash("random-hash"),
            role="user",
            storage_quota_gb=1,
            auth_provider="google",
            external_id="google-original-123"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # 다른 제공자로 연동
        linked_user = link_sso_to_user(
            db=db_session,
            user=user,
            provider="microsoft",
            external_id="ms-new-456",
            sso_email="ssouser@example.com"
        )
        
        assert linked_user.auth_provider == "microsoft"
        assert linked_user.external_id == "ms-new-456"


class TestStateValidation:
    """State 검증 테스트 (요구사항 8.1, 8.2)"""
    
    def test_generate_and_verify_state(self, setup_database, db_session):
        """State 생성 및 검증"""
        provider = "google"
        state = generate_state(db_session, provider)
        
        # State가 충분히 긴지 확인
        assert len(state) > 30
        
        # State 검증
        user_id = verify_state(db_session, state, provider)
        assert user_id is None  # 로그인 플로우는 user_id가 None
    
    def test_generate_state_with_user_id(self, setup_database, db_session):
        """User ID와 함께 State 생성 (계정 연동용)"""
        provider = "google"
        test_user_id = 123
        
        state = generate_state(db_session, provider, user_id=test_user_id)
        
        # State 검증
        verified_user_id = verify_state(db_session, state, provider)
        assert verified_user_id == test_user_id
    
    def test_verify_invalid_state_raises_error(self, setup_database, db_session):
        """잘못된 State는 에러 발생"""
        with pytest.raises(Exception):
            verify_state(db_session, "invalid-state-12345", "google")
    
    def test_verify_state_with_wrong_provider_raises_error(self, setup_database, db_session):
        """다른 제공자로 State 검증 시 에러"""
        state = generate_state(db_session, "google")
        
        with pytest.raises(Exception):
            verify_state(db_session, state, "microsoft")
    
    def test_state_is_single_use(self, setup_database, db_session):
        """State는 일회용 (재사용 불가)"""
        state = generate_state(db_session, "google")
        
        # 첫 번째 검증 성공
        verify_state(db_session, state, "google")
        
        # 두 번째 검증 실패
        with pytest.raises(Exception):
            verify_state(db_session, state, "google")
    
    def test_expired_state_cleanup(self, setup_database, db_session):
        """만료된 State 정리"""
        # 만료된 State 수동 생성
        expired_state = SSOState(
            state="expired-state-12345",
            provider="google",
            user_id=None,
            expires_at=datetime.now() - timedelta(minutes=5)
        )
        db_session.add(expired_state)
        db_session.commit()
        
        # 정리 실행
        count = cleanup_expired_states(db_session)
        
        assert count >= 1
        
        # 삭제 확인
        remaining = db_session.query(SSOState).filter(
            SSOState.state == "expired-state-12345"
        ).first()
        assert remaining is None


class TestJWTTokenGeneration:
    """JWT 토큰 생성 테스트"""
    
    def test_create_access_token_with_sso_info(self, setup_database, db_session):
        """SSO 정보가 포함된 JWT 토큰 생성"""
        # 사용자 조회
        user = db_session.query(User).filter(User.email == "first@example.com").first()
        
        # 토큰 생성
        token = create_access_token_with_sso(user)
        
        assert token is not None
        assert len(token) > 50
        
        # 토큰 검증
        payload = verify_token(token)
        
        assert payload["sub"] == user.username
        assert payload["user_id"] == user.id
        assert payload["auth_provider"] == user.auth_provider
        assert payload["email_verified"] == bool(user.email_verified)
    
    def test_token_contains_all_required_claims(self, setup_database, db_session):
        """토큰에 필수 클레임이 모두 포함되어 있는지 확인"""
        user = db_session.query(User).filter(User.email == "second@example.com").first()
        
        token = create_access_token_with_sso(user)
        payload = verify_token(token)
        
        # 필수 클레임 확인
        required_claims = ["sub", "user_id", "auth_provider", "email_verified", "exp"]
        for claim in required_claims:
            assert claim in payload, f"Missing claim: {claim}"


def run_tests():
    """테스트 실행"""
    import sys
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    print("=" * 60)
    print("SSO 인증 로직 테스트")
    print("=" * 60)
    run_tests()
