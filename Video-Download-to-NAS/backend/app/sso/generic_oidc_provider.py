"""Generic OIDC Provider implementation"""

from typing import Dict, Optional
from urllib.parse import urlencode
import httpx

from .oauth_provider import OAuth2Provider


class GenericOIDCProvider(OAuth2Provider):
    """범용 OIDC 제공자 구현
    
    사용자 정의 OIDC 제공자를 위한 범용 구현입니다.
    OIDC Discovery를 통한 자동 설정 검색을 지원하며,
    수동 엔드포인트 설정도 가능합니다.
    """
    
    DEFAULT_SCOPES = "openid email profile"
    
    def __init__(
        self, 
        client_id: str, 
        client_secret: str, 
        redirect_uri: str,
        discovery_url: Optional[str] = None,
        authorization_url: Optional[str] = None,
        token_url: Optional[str] = None,
        userinfo_url: Optional[str] = None,
        scopes: Optional[str] = None
    ):
        """Generic OIDC Provider 초기화
        
        Args:
            client_id: OAuth2 클라이언트 ID
            client_secret: OAuth2 클라이언트 시크릿
            redirect_uri: 콜백 리다이렉트 URI
            discovery_url: OIDC Discovery URL (예: https://provider.com/.well-known/openid-configuration)
            authorization_url: 수동 인증 URL (discovery_url이 없을 때 필수)
            token_url: 수동 토큰 URL (discovery_url이 없을 때 필수)
            userinfo_url: 수동 사용자 정보 URL (discovery_url이 없을 때 필수)
            scopes: OAuth2 스코프 (기본값: "openid email profile")
        """
        super().__init__(client_id, client_secret, redirect_uri)
        
        self.discovery_url = discovery_url
        self._authorization_url = authorization_url
        self._token_url = token_url
        self._userinfo_url = userinfo_url
        self.scopes = scopes or self.DEFAULT_SCOPES
        self._config = None
        self._config_loaded = False
    
    async def _load_oidc_config(self):
        """OIDC Discovery를 통한 설정 로드
        
        Discovery URL이 제공된 경우, .well-known/openid-configuration 엔드포인트에서
        OIDC 설정을 자동으로 로드합니다.
        """
        if self._config_loaded:
            return
        
        if self.discovery_url:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(self.discovery_url)
                    response.raise_for_status()
                    self._config = response.json()
                    self._config_loaded = True
            except Exception as e:
                # Discovery 실패 시 수동 설정으로 폴백
                if not (self._authorization_url and self._token_url and self._userinfo_url):
                    raise ValueError(
                        f"Failed to load OIDC discovery configuration and manual URLs not provided: {str(e)}"
                    )
                self._config = {
                    "authorization_endpoint": self._authorization_url,
                    "token_endpoint": self._token_url,
                    "userinfo_endpoint": self._userinfo_url
                }
                self._config_loaded = True
        else:
            # Discovery URL이 없으면 수동 설정 사용
            if not (self._authorization_url and self._token_url and self._userinfo_url):
                raise ValueError(
                    "Either discovery_url or all manual URLs (authorization_url, token_url, userinfo_url) must be provided"
                )
            self._config = {
                "authorization_endpoint": self._authorization_url,
                "token_endpoint": self._token_url,
                "userinfo_endpoint": self._userinfo_url
            }
            self._config_loaded = True
    
    async def get_authorization_url(self, state: str) -> str:
        """OIDC 인증 URL 생성
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            OIDC 인증 페이지 URL
        """
        # 설정이 로드되지 않았으면 먼저 로드
        if not self._config_loaded:
            await self._load_oidc_config()
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.scopes,
            "state": state
        }
        
        auth_url = self._config["authorization_endpoint"]
        return f"{auth_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> str:
        """OIDC 인증 코드를 액세스 토큰으로 교환
        
        Args:
            code: OIDC 인증 코드
            
        Returns:
            액세스 토큰
            
        Raises:
            httpx.HTTPStatusError: 토큰 교환 실패 시
        """
        if not self._config_loaded:
            await self._load_oidc_config()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self._config["token_endpoint"],
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
        """OIDC 제공자로부터 사용자 정보 조회
        
        Args:
            access_token: OIDC 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리:
            - email: 사용자 이메일
            - name: 사용자 이름
            - id: 사용자 ID
            - verified_email: 이메일 인증 여부
            
        Raises:
            httpx.HTTPStatusError: 사용자 정보 조회 실패 시
        """
        if not self._config_loaded:
            await self._load_oidc_config()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self._config["userinfo_endpoint"],
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            user_data = response.json()
            
            # 표준화된 형식으로 반환
            # OIDC 표준 클레임 사용
            email = user_data.get("email")
            username = user_data.get("preferred_username") or user_data.get("username")
            name = (
                user_data.get("name") or 
                username or 
                (email.split("@")[0] if email else "User")
            )
            user_id = (
                user_data.get("sub") or 
                user_data.get("id") or 
                user_data.get("user_id") or
                email
            )
            
            return {
                "email": email,
                "name": name,
                "username": username,  # 폴백용 username 추가
                "id": str(user_id),
                "verified_email": user_data.get("email_verified", True)
            }
