"""GitHub OAuth2 Provider implementation"""

from typing import Dict
from urllib.parse import urlencode
import httpx

from .oauth_provider import OAuth2Provider


class GitHubProvider(OAuth2Provider):
    """GitHub OAuth2 제공자 구현"""
    
    # GitHub OAuth2 엔드포인트
    AUTHORIZATION_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USERINFO_URL = "https://api.github.com/user"
    USER_EMAILS_URL = "https://api.github.com/user/emails"
    SCOPES = "read:user user:email"
    
    def get_authorization_url(self, state: str) -> str:
        """GitHub 인증 URL 생성
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            GitHub 인증 페이지 URL
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.SCOPES,
            "state": state,
            "allow_signup": "true"
        }
        
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"
    
    async def exchange_code_for_token(self, code: str) -> str:
        """GitHub 인증 코드를 액세스 토큰으로 교환
        
        Args:
            code: GitHub OAuth2 인증 코드
            
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
                    "redirect_uri": self.redirect_uri
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            response.raise_for_status()
            token_data = response.json()
            return token_data["access_token"]
    
    async def get_user_info(self, access_token: str) -> Dict:
        """GitHub API로부터 사용자 정보 조회
        
        Args:
            access_token: GitHub OAuth2 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리:
            - email: 사용자 이메일 (primary verified email)
            - name: 사용자 이름
            - id: GitHub 사용자 ID
            - verified_email: 이메일 인증 여부
            
        Raises:
            httpx.HTTPStatusError: 사용자 정보 조회 실패 시
        """
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        async with httpx.AsyncClient() as client:
            # 기본 사용자 정보 조회
            user_response = await client.get(
                self.USERINFO_URL,
                headers=headers
            )
            user_response.raise_for_status()
            user_data = user_response.json()
            
            # 이메일 정보 조회 (public email이 없을 수 있음)
            email = user_data.get("email")
            verified_email = False
            
            if not email:
                # 이메일 목록에서 primary verified email 찾기
                emails_response = await client.get(
                    self.USER_EMAILS_URL,
                    headers=headers
                )
                emails_response.raise_for_status()
                emails_data = emails_response.json()
                
                # primary이면서 verified된 이메일 찾기
                for email_info in emails_data:
                    if email_info.get("primary") and email_info.get("verified"):
                        email = email_info.get("email")
                        verified_email = True
                        break
                
                # primary verified가 없으면 첫 번째 verified 이메일 사용
                if not email:
                    for email_info in emails_data:
                        if email_info.get("verified"):
                            email = email_info.get("email")
                            verified_email = True
                            break
            else:
                # public email이 있으면 verified로 간주
                verified_email = True
            
            # 표준화된 형식으로 반환
            name = user_data.get("name") or user_data.get("login", "User")
            
            return {
                "email": email,
                "name": name,
                "id": str(user_data.get("id")),
                "verified_email": verified_email
            }
