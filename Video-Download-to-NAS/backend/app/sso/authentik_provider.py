"""Authentik OIDC Provider implementation"""

from typing import Dict, Optional
from urllib.parse import urlencode
import httpx

from .oauth_provider import OAuth2Provider


class AuthentikProvider(OAuth2Provider):
    """Authentik OIDC 제공자 구현
    
    Authentik은 완전한 OIDC 호환 제공자입니다.
    Discovery URL을 통한 자동 설정을 지원합니다.
    """
    
    # 기본 엔드포인트 경로 (도메인에 추가됨)
    DEFAULT_AUTH_PATH = "/application/o/authorize/"
    DEFAULT_TOKEN_PATH = "/application/o/token/"
    DEFAULT_USERINFO_PATH = "/application/o/userinfo/"
    SCOPES = "openid email profile"
    
    def __init__(
        self, 
        client_id: str, 
        client_secret: str, 
        redirect_uri: str,
        authentik_domain: str,
        application_slug: Optional[str] = None,
        discovery_url: Optional[str] = None,
        authorization_url: Optional[str] = None,
        token_url: Optional[str] = None,
        userinfo_url: Optional[str] = None
    ):
        """Authentik Provider 초기화
        
        Args:
            client_id: OAuth2 클라이언트 ID
            client_secret: OAuth2 클라이언트 시크릿
            redirect_uri: 콜백 리다이렉트 URI
            authentik_domain: Authentik 서버 도메인 (예: https://authentik.example.com)
            application_slug: Authentik 애플리케이션 slug (선택적)
            discovery_url: OIDC Discovery URL (선택적)
            authorization_url: 커스텀 인증 URL (선택적)
            token_url: 커스텀 토큰 URL (선택적)
            userinfo_url: 커스텀 사용자 정보 URL (선택적)
        """
        super().__init__(client_id, client_secret, redirect_uri)
        
        # 도메인에서 trailing slash 제거
        self.authentik_domain = authentik_domain.rstrip('/')
        self.application_slug = application_slug
        self.discovery_url = discovery_url
        
        # 커스텀 URL이 제공되지 않으면 기본 경로 사용
        if application_slug:
            # 애플리케이션별 엔드포인트
            base_path = f"/application/o/{application_slug}"
            self.authorization_url = authorization_url or f"{self.authentik_domain}{base_path}/authorize/"
            self.token_url = token_url or f"{self.authentik_domain}{base_path}/token/"
            self.userinfo_url = userinfo_url or f"{self.authentik_domain}{base_path}/userinfo/"
        else:
            # 일반 엔드포인트
            self.authorization_url = authorization_url or f"{self.authentik_domain}{self.DEFAULT_AUTH_PATH}"
            self.token_url = token_url or f"{self.authentik_domain}{self.DEFAULT_TOKEN_PATH}"
            self.userinfo_url = userinfo_url or f"{self.authentik_domain}{self.DEFAULT_USERINFO_PATH}"
        
        self._config = None
    
    async def _load_oidc_config(self):
        """OIDC Discovery를 통한 설정 로드"""
        if self._config or not self.discovery_url:
            return
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.discovery_url)
            response.raise_for_status()
            self._config = response.json()
            
            # Discovery에서 가져온 엔드포인트로 업데이트
            self.authorization_url = self._config.get("authorization_endpoint", self.authorization_url)
            self.token_url = self._config.get("token_endpoint", self.token_url)
            self.userinfo_url = self._config.get("userinfo_endpoint", self.userinfo_url)
    
    async def get_authorization_url(self, state: str) -> str:
        """Authentik 인증 URL 생성
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            Authentik 인증 페이지 URL
        """
        # Discovery 설정이 있으면 먼저 로드
        if self.discovery_url and not self._config:
            await self._load_oidc_config()
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state
        }
        
        return f"{self.authorization_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> str:
        """Authentik 인증 코드를 액세스 토큰으로 교환
        
        Args:
            code: Authentik OAuth2 인증 코드
            
        Returns:
            액세스 토큰
            
        Raises:
            httpx.HTTPStatusError: 토큰 교환 실패 시
        """
        # Discovery 설정이 있으면 로드
        if self.discovery_url and not self._config:
            await self._load_oidc_config()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code"
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            response.raise_for_status()
            token_data = response.json()
            return token_data["access_token"]
    
    async def get_user_info(self, access_token: str) -> Dict:
        """Authentik로부터 사용자 정보 조회
        
        Args:
            access_token: Authentik OAuth2 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리:
            - email: 사용자 이메일
            - name: 사용자 이름
            - id: Authentik 사용자 ID
            - verified_email: 이메일 인증 여부
            
        Raises:
            httpx.HTTPStatusError: 사용자 정보 조회 실패 시
        """
        # Discovery 설정이 있으면 로드
        if self.discovery_url and not self._config:
            await self._load_oidc_config()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            user_data = response.json()
            
            # 표준화된 형식으로 반환
            # Authentik은 OIDC 표준을 따름
            email = user_data.get("email")
            username = user_data.get("preferred_username") or user_data.get("username")
            sub = user_data.get("sub")
            
            # ID 우선순위: sub > username
            user_id = sub or username
            
            # 이름 우선순위: name > username > email 앞부분
            name = user_data.get("name") or username or (email.split("@")[0] if email else "User")
            
            return {
                "email": email,
                "name": name,
                "username": username,  # 폴백용 username 추가
                "id": user_id,
                "verified_email": user_data.get("email_verified", True)
            }
