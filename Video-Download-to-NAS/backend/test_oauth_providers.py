#!/usr/bin/env python3
"""
OAuth2 Provider 단위 테스트

이 모듈은 OAuth2 제공자들의 기본 기능을 테스트합니다.
실제 API 호출 대신 모의(mock) 응답을 사용하여 테스트합니다.

요구사항: 2.1, 3.1, 4.1
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.sso.google_provider import GoogleProvider
from app.sso.microsoft_provider import MicrosoftProvider
from app.sso.github_provider import GitHubProvider
from app.sso.generic_oidc_provider import GenericOIDCProvider


class TestGoogleProvider:
    """Google OAuth2 Provider 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.provider = GoogleProvider(
            client_id="test-google-client-id",
            client_secret="test-google-client-secret",
            redirect_uri="http://localhost:8000/api/sso/google/callback"
        )
    
    def test_initialization(self):
        """Provider 초기화 테스트"""
        assert self.provider.client_id == "test-google-client-id"
        assert self.provider.client_secret == "test-google-client-secret"
        assert self.provider.redirect_uri == "http://localhost:8000/api/sso/google/callback"
    
    def test_get_authorization_url(self):
        """인증 URL 생성 테스트"""
        state = "test-state-12345"
        url = self.provider.get_authorization_url(state)
        
        # URL 구조 검증
        assert "accounts.google.com" in url
        assert "oauth2/v2/auth" in url
        assert f"state={state}" in url
        assert f"client_id={self.provider.client_id}" in url
        assert "redirect_uri=" in url
        assert "response_type=code" in url
        assert "scope=" in url
        assert "openid" in url
        assert "email" in url
        assert "profile" in url
    
    @pytest.mark.asyncio
    async def test_exchange_code_for_token_success(self):
        """토큰 교환 성공 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "test-access-token"}
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            
            token = await self.provider.exchange_code_for_token("test-code")
            
            assert token == "test-access-token"
    
    @pytest.mark.asyncio
    async def test_get_user_info_success(self):
        """사용자 정보 조회 성공 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "email": "test@gmail.com",
            "name": "Test User",
            "id": "google-123",
            "verified_email": True
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "test@gmail.com"
            assert user_info["name"] == "Test User"
            assert user_info["id"] == "google-123"
            assert user_info["verified_email"] is True
    
    @pytest.mark.asyncio
    async def test_get_user_info_without_name(self):
        """이름이 없는 경우 이메일에서 추출 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "email": "testuser@gmail.com",
            "id": "google-456",
            "verified_email": True
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["name"] == "testuser"


class TestMicrosoftProvider:
    """Microsoft OAuth2 Provider 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.provider = MicrosoftProvider(
            client_id="test-ms-client-id",
            client_secret="test-ms-client-secret",
            redirect_uri="http://localhost:8000/api/sso/microsoft/callback"
        )
    
    def test_initialization(self):
        """Provider 초기화 테스트"""
        assert self.provider.client_id == "test-ms-client-id"
        assert self.provider.client_secret == "test-ms-client-secret"
    
    def test_get_authorization_url(self):
        """인증 URL 생성 테스트"""
        state = "test-state-67890"
        url = self.provider.get_authorization_url(state)
        
        # URL 구조 검증
        assert "login.microsoftonline.com" in url
        assert "oauth2/v2.0/authorize" in url
        assert f"state={state}" in url
        assert f"client_id={self.provider.client_id}" in url
        assert "User.Read" in url
    
    @pytest.mark.asyncio
    async def test_exchange_code_for_token_success(self):
        """토큰 교환 성공 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "ms-access-token"}
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            
            token = await self.provider.exchange_code_for_token("test-code")
            
            assert token == "ms-access-token"
    
    @pytest.mark.asyncio
    async def test_get_user_info_with_mail(self):
        """mail 필드가 있는 경우 사용자 정보 조회 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "mail": "test@outlook.com",
            "displayName": "Test User",
            "id": "ms-123"
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "test@outlook.com"
            assert user_info["name"] == "Test User"
            assert user_info["id"] == "ms-123"
            assert user_info["verified_email"] is True
    
    @pytest.mark.asyncio
    async def test_get_user_info_with_upn(self):
        """userPrincipalName을 이메일로 사용하는 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "userPrincipalName": "test@company.com",
            "displayName": "Corporate User",
            "id": "ms-456"
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "test@company.com"
            assert user_info["name"] == "Corporate User"


class TestGitHubProvider:
    """GitHub OAuth2 Provider 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.provider = GitHubProvider(
            client_id="test-gh-client-id",
            client_secret="test-gh-client-secret",
            redirect_uri="http://localhost:8000/api/sso/github/callback"
        )
    
    def test_initialization(self):
        """Provider 초기화 테스트"""
        assert self.provider.client_id == "test-gh-client-id"
        assert self.provider.client_secret == "test-gh-client-secret"
    
    def test_get_authorization_url(self):
        """인증 URL 생성 테스트"""
        state = "test-state-abc123"
        url = self.provider.get_authorization_url(state)
        
        # URL 구조 검증
        assert "github.com" in url
        assert "login/oauth/authorize" in url
        assert f"state={state}" in url
        assert f"client_id={self.provider.client_id}" in url
        assert "read:user" in url
        assert "user:email" in url
    
    @pytest.mark.asyncio
    async def test_exchange_code_for_token_success(self):
        """토큰 교환 성공 테스트"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "gh-access-token"}
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            
            token = await self.provider.exchange_code_for_token("test-code")
            
            assert token == "gh-access-token"
    
    @pytest.mark.asyncio
    async def test_get_user_info_with_public_email(self):
        """공개 이메일이 있는 경우 사용자 정보 조회 테스트"""
        mock_user_response = MagicMock()
        mock_user_response.json.return_value = {
            "email": "public@github.com",
            "name": "GitHub User",
            "id": 12345,
            "login": "githubuser"
        }
        mock_user_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_user_response)
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "public@github.com"
            assert user_info["name"] == "GitHub User"
            assert user_info["id"] == "12345"
            assert user_info["verified_email"] is True
    
    @pytest.mark.asyncio
    async def test_get_user_info_without_public_email(self):
        """공개 이메일이 없는 경우 이메일 API 조회 테스트"""
        mock_user_response = MagicMock()
        mock_user_response.json.return_value = {
            "email": None,
            "name": "Private User",
            "id": 67890,
            "login": "privateuser"
        }
        mock_user_response.raise_for_status = MagicMock()
        
        mock_emails_response = MagicMock()
        mock_emails_response.json.return_value = [
            {"email": "private@github.com", "primary": True, "verified": True},
            {"email": "other@github.com", "primary": False, "verified": True}
        ]
        mock_emails_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(side_effect=[mock_user_response, mock_emails_response])
            mock_client.return_value.__aenter__.return_value.get = mock_get
            
            user_info = await self.provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "private@github.com"
            assert user_info["name"] == "Private User"
            assert user_info["verified_email"] is True


class TestGenericOIDCProvider:
    """Generic OIDC Provider 테스트"""
    
    def test_initialization_with_manual_urls(self):
        """수동 URL로 초기화 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback",
            authorization_url="https://provider.com/oauth/authorize",
            token_url="https://provider.com/oauth/token",
            userinfo_url="https://provider.com/oauth/userinfo"
        )
        
        assert provider.client_id == "test-oidc-client-id"
        assert provider._authorization_url == "https://provider.com/oauth/authorize"
        assert provider._token_url == "https://provider.com/oauth/token"
        assert provider._userinfo_url == "https://provider.com/oauth/userinfo"
    
    def test_initialization_with_discovery_url(self):
        """Discovery URL로 초기화 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback",
            discovery_url="https://provider.com/.well-known/openid-configuration"
        )
        
        assert provider.discovery_url == "https://provider.com/.well-known/openid-configuration"
    
    def test_initialization_without_urls_raises_error(self):
        """URL 없이 초기화 시 에러 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback"
        )
        
        # get_authorization_url 호출 시 에러 발생해야 함
        with pytest.raises(ValueError):
            provider.get_authorization_url("test-state")
    
    @pytest.mark.asyncio
    async def test_load_oidc_config_from_discovery(self):
        """Discovery URL에서 설정 로드 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback",
            discovery_url="https://provider.com/.well-known/openid-configuration"
        )
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "authorization_endpoint": "https://provider.com/oauth/authorize",
            "token_endpoint": "https://provider.com/oauth/token",
            "userinfo_endpoint": "https://provider.com/oauth/userinfo"
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            await provider._load_oidc_config()
            
            assert provider._config["authorization_endpoint"] == "https://provider.com/oauth/authorize"
            assert provider._config["token_endpoint"] == "https://provider.com/oauth/token"
            assert provider._config["userinfo_endpoint"] == "https://provider.com/oauth/userinfo"
    
    def test_get_authorization_url_with_manual_config(self):
        """수동 설정으로 인증 URL 생성 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback",
            authorization_url="https://provider.com/oauth/authorize",
            token_url="https://provider.com/oauth/token",
            userinfo_url="https://provider.com/oauth/userinfo"
        )
        
        state = "test-state-oidc"
        url = provider.get_authorization_url(state)
        
        assert "provider.com" in url
        assert "oauth/authorize" in url
        assert f"state={state}" in url
        assert f"client_id={provider.client_id}" in url
        assert "openid" in url
    
    @pytest.mark.asyncio
    async def test_get_user_info_with_standard_claims(self):
        """표준 OIDC 클레임으로 사용자 정보 조회 테스트"""
        provider = GenericOIDCProvider(
            client_id="test-oidc-client-id",
            client_secret="test-oidc-client-secret",
            redirect_uri="http://localhost:8000/api/sso/oidc/callback",
            authorization_url="https://provider.com/oauth/authorize",
            token_url="https://provider.com/oauth/token",
            userinfo_url="https://provider.com/oauth/userinfo"
        )
        
        # 설정 수동 로드
        provider._config = {
            "authorization_endpoint": "https://provider.com/oauth/authorize",
            "token_endpoint": "https://provider.com/oauth/token",
            "userinfo_endpoint": "https://provider.com/oauth/userinfo"
        }
        provider._config_loaded = True
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "sub": "oidc-user-123",
            "email": "user@provider.com",
            "name": "OIDC User",
            "email_verified": True
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            user_info = await provider.get_user_info("test-access-token")
            
            assert user_info["email"] == "user@provider.com"
            assert user_info["name"] == "OIDC User"
            assert user_info["id"] == "oidc-user-123"
            assert user_info["verified_email"] is True


def run_tests():
    """테스트 실행 함수"""
    import sys
    
    # pytest 실행
    exit_code = pytest.main([__file__, "-v", "--tb=short"])
    sys.exit(exit_code)


if __name__ == "__main__":
    print("=" * 60)
    print("OAuth2 Provider 단위 테스트")
    print("=" * 60)
    run_tests()
