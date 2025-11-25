"""OAuth2 Provider abstract base class"""

from abc import ABC, abstractmethod
from typing import Dict


class OAuth2Provider(ABC):
    """OAuth2 제공자 추상 클래스
    
    모든 OAuth2 제공자는 이 클래스를 상속받아 구현해야 합니다.
    """
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        """OAuth2 Provider 초기화
        
        Args:
            client_id: OAuth2 클라이언트 ID
            client_secret: OAuth2 클라이언트 시크릿
            redirect_uri: 콜백 리다이렉트 URI
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
    
    @abstractmethod
    def get_authorization_url(self, state: str) -> str:
        """인증 URL 생성
        
        사용자를 OAuth2 제공자의 인증 페이지로 리다이렉트하기 위한 URL을 생성합니다.
        
        Args:
            state: CSRF 방지를 위한 state 파라미터
            
        Returns:
            인증 URL (쿼리 파라미터 포함)
        """
        pass
    
    @abstractmethod
    async def exchange_code_for_token(self, code: str) -> str:
        """인증 코드를 액세스 토큰으로 교환
        
        OAuth2 Authorization Code Flow의 일부로, 
        인증 코드를 액세스 토큰으로 교환합니다.
        
        Args:
            code: OAuth2 인증 코드
            
        Returns:
            액세스 토큰
            
        Raises:
            HTTPException: 토큰 교환 실패 시
        """
        pass
    
    @abstractmethod
    async def get_user_info(self, access_token: str) -> Dict:
        """사용자 정보 조회
        
        액세스 토큰을 사용하여 OAuth2 제공자로부터 사용자 정보를 조회합니다.
        
        Args:
            access_token: OAuth2 액세스 토큰
            
        Returns:
            사용자 정보 딕셔너리 (최소한 'email'과 'name' 포함)
            
        Raises:
            HTTPException: 사용자 정보 조회 실패 시
        """
        pass
