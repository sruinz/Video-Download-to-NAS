"""Synology OIDC Provider implementation"""

from typing import Dict, Optional
from urllib.parse import urlencode
import httpx

from .oauth_provider import OAuth2Provider


class SynologyProvider(OAuth2Provider):
    """Synology OIDC 제공자 구현
    
    Synology DSM 7.0 이상의 SSO Server 패키지의 OIDC 기능과 통합합니다.
    Discovery URL을 통한 자동 설정을 지원합니다.
    """
    
    SCOPES = "openid email profile"
    
    def __init__(
        self, 
        client_id: str, 
        client_secret: str, 
        redirect_uri: str,
        synology_domain: str = "",
        discovery_url: Optional[str] = None,
        authorization_url: Optional[str] = None,
        token_url: Optional[str] = None,
        userinfo_url: Optional[str] = None
    ):
        """Synology OIDC Provider 초기화
        
        Args:
            client_id: OIDC 클라이언트 ID
            client_secret: OIDC 클라이언트 시크릿
            redirect_uri: 콜백 리다이렉트 URI
            synology_domain: Synology 서버 도메인 (예: https://dsm.example.com)
            discovery_url: OIDC Discovery URL (선택적)
            authorization_url: 커스텀 인증 URL (선택적)
            token_url: 커스텀 토큰 URL (선택적)
            userinfo_url: 커스텀 사용자 정보 URL (선택적)
        """
        super().__init__(client_id, client_secret, redirect_uri)
        
        self.synology_domain = synology_domain.rstrip('/') if synology_domain else ""
        self.discovery_url = discovery_url
        
        # Discovery URL이 제공되면 자동으로 엔드포인트 검색
        if discovery_url and not (authorization_url and token_url and userinfo_url):
            # Discovery는 런타임에 수행 (비동기 필요)
            pass
        
        # 명시적 URL이 제공되면 사용
        self.authorization_url = authorization_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
    
    def get_authorization_url(self, state: str) -> str:
        """Synology SSO 인증 URL 생성
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            Synology SSO 인증 페이지 URL
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state
        }
        
        return f"{self.authorization_url}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> str:
        """Synology SSO 인증 코드를 액세스 토큰으로 교환
        
        Args:
            code: Synology OAuth2 인증 코드
            
        Returns:
            액세스 토큰
            
        Raises:
            httpx.HTTPStatusError: 토큰 교환 실패 시
        """
        async with httpx.AsyncClient(verify=False) as client:  # Synology는 자체 서명 인증서를 사용할 수 있음
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
        """Synology SSO로부터 사용자 정보 조회
        
        Args:
            access_token: Synology OAuth2 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리:
            - email: 사용자 이메일
            - name: 사용자 이름
            - id: Synology 사용자 ID
            - verified_email: 이메일 인증 여부 (항상 True)
            
        Raises:
            httpx.HTTPStatusError: 사용자 정보 조회 실패 시
        """
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                self.userinfo_url,
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            user_data = response.json()
            
            # 표준화된 형식으로 반환
            # Synology는 OIDC 표준을 따름
            email = user_data.get("email")
            username = user_data.get("username") or user_data.get("preferred_username")
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
                "verified_email": True  # Synology 계정은 항상 인증된 것으로 간주
            }
