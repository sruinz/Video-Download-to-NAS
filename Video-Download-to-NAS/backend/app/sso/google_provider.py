"""Google OAuth2 Provider implementation"""

from typing import Dict
from urllib.parse import urlencode
import httpx

from .oauth_provider import OAuth2Provider


class GoogleProvider(OAuth2Provider):
    """Google OAuth2 제공자 구현"""
    
    # Google OAuth2 엔드포인트
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    SCOPES = "openid email profile"
    
    def get_authorization_url(self, state: str) -> str:
        """Google 인증 URL 생성
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            Google 인증 페이지 URL
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
            "access_type": "online",
            "prompt": "select_account"
        }
        
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> str:
        """Google 인증 코드를 액세스 토큰으로 교환
        
        Args:
            code: Google OAuth2 인증 코드
            
        Returns:
            액세스 토큰
            
        Raises:
            httpx.HTTPStatusError: 토큰 교환 실패 시
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
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
        """Google로부터 사용자 정보 조회
        
        Args:
            access_token: Google OAuth2 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리:
            - email: 사용자 이메일
            - name: 사용자 이름
            - id: Google 사용자 ID
            - verified_email: 이메일 인증 여부
            
        Raises:
            httpx.HTTPStatusError: 사용자 정보 조회 실패 시
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                headers={
                    "Authorization": f"Bearer {access_token}"
                }
            )
            response.raise_for_status()
            user_data = response.json()
            
            # 표준화된 형식으로 반환
            return {
                "email": user_data.get("email"),
                "name": user_data.get("name", user_data.get("email", "").split("@")[0]),
                "id": user_data.get("id"),
                "verified_email": user_data.get("verified_email", False)
            }
