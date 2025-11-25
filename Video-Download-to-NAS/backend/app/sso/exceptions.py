"""
SSO Exception Classes

This module defines custom exceptions for SSO authentication flows
to provide clear, user-friendly error messages.

Requirements: 9.1, 9.2, 9.3, 9.4
"""

from fastapi import HTTPException, status


class SSOException(HTTPException):
    """Base exception for SSO-related errors"""
    
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class SSOAuthenticationError(SSOException):
    """OAuth2 인증 실패 오류"""
    
    def __init__(self, provider: str, reason: str = None):
        detail = f"Authentication with {provider} failed"
        if reason:
            detail += f": {reason}"
        super().__init__(
            detail=detail,
            status_code=status.HTTP_401_UNAUTHORIZED
        )


class SSOStateError(SSOException):
    """State 파라미터 불일치 오류 (CSRF 공격 방지)"""
    
    def __init__(self):
        super().__init__(
            detail="Invalid or expired authentication state. Please try again.",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSOEmailMismatchError(SSOException):
    """이메일 불일치 오류 (계정 연동 시)"""
    
    def __init__(self, user_email: str, sso_email: str):
        super().__init__(
            detail=(
                f"Email mismatch: Your account email ({user_email}) does not match "
                f"the SSO provider email ({sso_email}). Cannot link accounts."
            ),
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSOProviderNotConfiguredError(SSOException):
    """Provider 설정 누락 오류"""
    
    def __init__(self, provider: str):
        super().__init__(
            detail=f"{provider} SSO is not configured or is currently disabled. Please contact administrator.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class SSORegistrationDisabledError(SSOException):
    """등록 비활성화 오류"""
    
    def __init__(self):
        super().__init__(
            detail="Registration is disabled. Please contact administrator to create an account.",
            status_code=status.HTTP_403_FORBIDDEN
        )


class SSOProviderNotFoundError(SSOException):
    """Provider를 찾을 수 없는 오류"""
    
    def __init__(self, provider: str):
        super().__init__(
            detail=f"SSO provider '{provider}' not found.",
            status_code=status.HTTP_404_NOT_FOUND
        )


class SSOAlreadyLinkedError(SSOException):
    """이미 연동된 Provider 오류"""
    
    def __init__(self, provider: str):
        super().__init__(
            detail=f"Your account is already linked to {provider}.",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSONotLinkedError(SSOException):
    """연동되지 않은 Provider 오류"""
    
    def __init__(self, provider: str):
        super().__init__(
            detail=f"Your account is not linked to {provider}.",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSOUserInfoError(SSOException):
    """Provider로부터 사용자 정보를 가져오지 못한 오류"""
    
    def __init__(self, provider: str, missing_fields: list = None):
        if missing_fields:
            detail = f"{provider} did not return required user information: {', '.join(missing_fields)}"
        else:
            detail = f"Failed to retrieve user information from {provider}"
        
        super().__init__(
            detail=detail,
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSOTokenExchangeError(SSOException):
    """인증 코드를 토큰으로 교환하는데 실패한 오류"""
    
    def __init__(self, provider: str, reason: str = None):
        detail = f"Failed to exchange authorization code with {provider}"
        if reason:
            detail += f": {reason}"
        
        super().__init__(
            detail=detail,
            status_code=status.HTTP_400_BAD_REQUEST
        )


class SSONetworkError(SSOException):
    """네트워크 연결 오류"""
    
    def __init__(self, provider: str):
        super().__init__(
            detail=f"Network error while connecting to {provider}. Please try again later.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
