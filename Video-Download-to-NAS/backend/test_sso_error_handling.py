"""
SSO Error Handling Tests

This module tests the error handling functionality of the SSO authentication system.

Requirements: 9.1, 9.2, 9.3, 9.4
"""

import pytest
from fastapi import status
from app.sso.exceptions import (
    SSOAuthenticationError,
    SSOStateError,
    SSOEmailMismatchError,
    SSOProviderNotConfiguredError,
    SSORegistrationDisabledError,
    SSOProviderNotFoundError,
    SSOAlreadyLinkedError,
    SSONotLinkedError,
    SSOUserInfoError,
    SSOTokenExchangeError,
    SSONetworkError
)


def test_sso_authentication_error():
    """Test SSOAuthenticationError exception"""
    error = SSOAuthenticationError("google", "Invalid credentials")
    
    assert error.status_code == status.HTTP_401_UNAUTHORIZED
    assert "google" in error.detail
    assert "Invalid credentials" in error.detail


def test_sso_state_error():
    """Test SSOStateError exception"""
    error = SSOStateError()
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "state" in error.detail.lower()


def test_sso_email_mismatch_error():
    """Test SSOEmailMismatchError exception"""
    error = SSOEmailMismatchError("user@example.com", "sso@example.com")
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "user@example.com" in error.detail
    assert "sso@example.com" in error.detail
    assert "mismatch" in error.detail.lower()


def test_sso_provider_not_configured_error():
    """Test SSOProviderNotConfiguredError exception"""
    error = SSOProviderNotConfiguredError("google")
    
    assert error.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert "google" in error.detail
    assert "not configured" in error.detail.lower() or "disabled" in error.detail.lower()


def test_sso_registration_disabled_error():
    """Test SSORegistrationDisabledError exception"""
    error = SSORegistrationDisabledError()
    
    assert error.status_code == status.HTTP_403_FORBIDDEN
    assert "registration" in error.detail.lower()
    assert "disabled" in error.detail.lower()


def test_sso_provider_not_found_error():
    """Test SSOProviderNotFoundError exception"""
    error = SSOProviderNotFoundError("unknown_provider")
    
    assert error.status_code == status.HTTP_404_NOT_FOUND
    assert "unknown_provider" in error.detail
    assert "not found" in error.detail.lower()


def test_sso_already_linked_error():
    """Test SSOAlreadyLinkedError exception"""
    error = SSOAlreadyLinkedError("google")
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in error.detail
    assert "already linked" in error.detail.lower()


def test_sso_not_linked_error():
    """Test SSONotLinkedError exception"""
    error = SSONotLinkedError("google")
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in error.detail
    assert "not linked" in error.detail.lower()


def test_sso_user_info_error_with_missing_fields():
    """Test SSOUserInfoError with missing fields"""
    error = SSOUserInfoError("google", ["email", "id"])
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in error.detail
    assert "email" in error.detail
    assert "id" in error.detail


def test_sso_user_info_error_without_missing_fields():
    """Test SSOUserInfoError without specific missing fields"""
    error = SSOUserInfoError("google")
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in error.detail
    assert "user information" in error.detail.lower()


def test_sso_token_exchange_error():
    """Test SSOTokenExchangeError exception"""
    error = SSOTokenExchangeError("google", "Invalid authorization code")
    
    assert error.status_code == status.HTTP_400_BAD_REQUEST
    assert "google" in error.detail
    assert "Invalid authorization code" in error.detail


def test_sso_network_error():
    """Test SSONetworkError exception"""
    error = SSONetworkError("google")
    
    assert error.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert "google" in error.detail
    assert "network" in error.detail.lower()


def test_all_exceptions_inherit_from_sso_exception():
    """Test that all SSO exceptions inherit from SSOException"""
    from app.sso.exceptions import SSOException
    
    exceptions = [
        SSOAuthenticationError("test"),
        SSOStateError(),
        SSOEmailMismatchError("a@test.com", "b@test.com"),
        SSOProviderNotConfiguredError("test"),
        SSORegistrationDisabledError(),
        SSOProviderNotFoundError("test"),
        SSOAlreadyLinkedError("test"),
        SSONotLinkedError("test"),
        SSOUserInfoError("test"),
        SSOTokenExchangeError("test"),
        SSONetworkError("test")
    ]
    
    for exc in exceptions:
        assert isinstance(exc, SSOException)


def test_exception_messages_are_user_friendly():
    """Test that exception messages are user-friendly (no technical jargon)"""
    exceptions = [
        SSOAuthenticationError("google"),
        SSOStateError(),
        SSOProviderNotConfiguredError("google"),
        SSORegistrationDisabledError(),
        SSONetworkError("google")
    ]
    
    # Check that messages don't contain technical terms
    technical_terms = ["exception", "traceback", "stack", "null", "undefined"]
    
    for exc in exceptions:
        detail_lower = exc.detail.lower()
        for term in technical_terms:
            assert term not in detail_lower, f"Technical term '{term}' found in: {exc.detail}"


if __name__ == "__main__":
    # Run tests
    print("Running SSO Error Handling Tests...")
    print("\n" + "="*60)
    
    test_functions = [
        test_sso_authentication_error,
        test_sso_state_error,
        test_sso_email_mismatch_error,
        test_sso_provider_not_configured_error,
        test_sso_registration_disabled_error,
        test_sso_provider_not_found_error,
        test_sso_already_linked_error,
        test_sso_not_linked_error,
        test_sso_user_info_error_with_missing_fields,
        test_sso_user_info_error_without_missing_fields,
        test_sso_token_exchange_error,
        test_sso_network_error,
        test_all_exceptions_inherit_from_sso_exception,
        test_exception_messages_are_user_friendly
    ]
    
    passed = 0
    failed = 0
    
    for test_func in test_functions:
        try:
            test_func()
            print(f"✅ {test_func.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"❌ {test_func.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__}: Unexpected error: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ {failed} test(s) failed")
