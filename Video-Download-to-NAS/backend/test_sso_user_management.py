#!/usr/bin/env python3
"""
Test script for SSO user management functions.
This verifies the create_or_get_user_from_sso, link_sso_to_user, and create_access_token_with_sso functions.
"""

import os
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set test environment variables
os.environ["SSO_ENCRYPTION_KEY"] = "test-key-for-testing-only-not-secure-1234567890abcdef"
os.environ["DATABASE_URL"] = "sqlite:///./test_sso_user_management.db"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-testing-only"

from app.sso.user_management import (
    create_or_get_user_from_sso,
    link_sso_to_user,
    create_access_token_with_sso
)
from app.database import init_db, SessionLocal, Base, engine, User, SystemSetting
from app.auth import verify_token

def setup_test_db():
    """Initialize test database with default settings"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Add default settings
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

def test_create_first_user():
    """Test creating the first user (should get super_admin role)"""
    print("\n=== Testing First User Creation (Super Admin) ===")
    
    db = SessionLocal()
    
    try:
        user_info = {
            "email": "first@example.com",
            "name": "First User",
            "verified_email": True
        }
        
        user = create_or_get_user_from_sso(
            db=db,
            provider="google",
            external_id="google-123",
            user_info=user_info
        )
        
        print(f"Created user: {user.username}")
        print(f"Role: {user.role}")
        print(f"Quota: {user.storage_quota_gb}GB")
        print(f"Auth provider: {user.auth_provider}")
        print(f"External ID: {user.external_id}")
        print(f"Email verified: {user.email_verified}")
        
        # Verify first user gets super_admin
        assert user.role == "super_admin", "First user should be super_admin"
        assert user.storage_quota_gb == 100, "Super admin should get 100GB"
        assert user.auth_provider == "google", "Auth provider should be google"
        assert user.external_id == "google-123", "External ID should match"
        assert user.email_verified == 1, "Email should be verified"
        assert user.can_download_to_nas == 1, "Super admin should have all permissions"
        
        print("✅ First user creation test passed!")
        return True
        
    finally:
        db.close()

def test_create_second_user():
    """Test creating a second user (should get default role)"""
    print("\n=== Testing Second User Creation (Default Role) ===")
    
    db = SessionLocal()
    
    try:
        user_info = {
            "email": "second@example.com",
            "name": "Second User",
            "verified_email": False
        }
        
        user = create_or_get_user_from_sso(
            db=db,
            provider="microsoft",
            external_id="ms-456",
            user_info=user_info
        )
        
        print(f"Created user: {user.username}")
        print(f"Role: {user.role}")
        print(f"Quota: {user.storage_quota_gb}GB")
        print(f"Email verified: {user.email_verified}")
        
        # Verify second user gets default role
        assert user.role == "user", "Second user should get default role"
        assert user.storage_quota_gb == 1, "Default user should get 1GB"
        assert user.auth_provider == "microsoft", "Auth provider should be microsoft"
        assert user.email_verified == 0, "Email should not be verified"
        
        print("✅ Second user creation test passed!")
        return True
        
    finally:
        db.close()

def test_get_existing_user():
    """Test retrieving an existing user by provider and external_id"""
    print("\n=== Testing Get Existing User ===")
    
    db = SessionLocal()
    
    try:
        user_info = {
            "email": "first@example.com",
            "name": "First User",
            "verified_email": True
        }
        
        # Should return existing user, not create new one
        user = create_or_get_user_from_sso(
            db=db,
            provider="google",
            external_id="google-123",
            user_info=user_info
        )
        
        print(f"Retrieved user: {user.username}")
        print(f"Role: {user.role}")
        
        # Verify it's the same user
        assert user.role == "super_admin", "Should be the first user"
        assert user.email == "first@example.com", "Email should match"
        
        # Check that we still have only 2 users total
        user_count = db.query(User).count()
        assert user_count == 2, f"Should have 2 users, found {user_count}"
        
        print("✅ Get existing user test passed!")
        return True
        
    finally:
        db.close()

def test_link_by_email():
    """Test linking SSO provider to existing user by email match"""
    print("\n=== Testing Link by Email Match ===")
    
    db = SessionLocal()
    
    try:
        # Create a local user first
        from app.auth import get_password_hash
        local_user = User(
            username="localuser",
            email="local@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db.add(local_user)
        db.commit()
        db.refresh(local_user)
        
        print(f"Created local user: {local_user.username}")
        print(f"Auth provider before: {local_user.auth_provider}")
        
        # Now try to login with SSO using same email
        user_info = {
            "email": "local@example.com",
            "name": "Local User",
            "verified_email": True
        }
        
        user = create_or_get_user_from_sso(
            db=db,
            provider="github",
            external_id="gh-789",
            user_info=user_info
        )
        
        print(f"After SSO login:")
        print(f"Username: {user.username}")
        print(f"Auth provider: {user.auth_provider}")
        print(f"External ID: {user.external_id}")
        
        # Verify the local user was linked to GitHub
        assert user.id == local_user.id, "Should be the same user"
        assert user.auth_provider == "github", "Should be linked to GitHub"
        assert user.external_id == "gh-789", "External ID should be set"
        assert user.email_verified == 1, "Email should be verified"
        
        print("✅ Link by email test passed!")
        return True
        
    finally:
        db.close()

def test_link_sso_to_user_function():
    """Test the link_sso_to_user function directly"""
    print("\n=== Testing link_sso_to_user Function ===")
    
    db = SessionLocal()
    
    try:
        # Create a user
        from app.auth import get_password_hash
        user = User(
            username="linktest",
            email="linktest@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"Created user: {user.username}")
        print(f"Auth provider before: {user.auth_provider}")
        
        # Link SSO provider
        linked_user = link_sso_to_user(
            db=db,
            user=user,
            provider="google",
            external_id="google-link-123",
            sso_email="linktest@example.com"
        )
        
        print(f"After linking:")
        print(f"Auth provider: {linked_user.auth_provider}")
        print(f"External ID: {linked_user.external_id}")
        
        assert linked_user.auth_provider == "google", "Should be linked to Google"
        assert linked_user.external_id == "google-link-123", "External ID should be set"
        
        print("✅ link_sso_to_user test passed!")
        return True
        
    finally:
        db.close()

def test_link_email_mismatch():
    """Test that linking fails when emails don't match"""
    print("\n=== Testing Email Mismatch Error ===")
    
    db = SessionLocal()
    
    try:
        # Create a user
        from app.auth import get_password_hash
        user = User(
            username="mismatchtest",
            email="correct@example.com",
            hashed_password=get_password_hash("password123"),
            role="user",
            storage_quota_gb=1,
            auth_provider="local"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"Created user with email: {user.email}")
        
        # Try to link with different email
        try:
            link_sso_to_user(
                db=db,
                user=user,
                provider="google",
                external_id="google-mismatch-123",
                sso_email="wrong@example.com"
            )
            print("❌ Should have raised ValueError for email mismatch")
            return False
        except ValueError as e:
            print(f"✅ Correctly rejected email mismatch: {e}")
            return True
        
    finally:
        db.close()

def test_create_access_token_with_sso():
    """Test JWT token creation with SSO information"""
    print("\n=== Testing JWT Token with SSO Info ===")
    
    db = SessionLocal()
    
    try:
        # Get an existing user
        user = db.query(User).filter(User.email == "first@example.com").first()
        
        print(f"Creating token for user: {user.username}")
        print(f"Auth provider: {user.auth_provider}")
        print(f"Email verified: {user.email_verified}")
        
        # Create token
        token = create_access_token_with_sso(user)
        
        print(f"Generated token: {token[:50]}...")
        
        # Verify token contains SSO information
        payload = verify_token(token)
        
        print(f"Token payload:")
        print(f"  sub: {payload.get('sub')}")
        print(f"  user_id: {payload.get('user_id')}")
        print(f"  auth_provider: {payload.get('auth_provider')}")
        print(f"  email_verified: {payload.get('email_verified')}")
        
        assert payload.get("sub") == user.username, "Username should match"
        assert payload.get("user_id") == user.id, "User ID should match"
        assert payload.get("auth_provider") == user.auth_provider, "Auth provider should be in token"
        assert payload.get("email_verified") == bool(user.email_verified), "Email verified should be in token"
        
        print("✅ JWT token with SSO info test passed!")
        return True
        
    finally:
        db.close()

def test_registration_disabled():
    """Test that user creation fails when registration is disabled"""
    print("\n=== Testing Registration Disabled ===")
    
    db = SessionLocal()
    
    try:
        # Disable registration
        setting = db.query(SystemSetting).filter(SystemSetting.key == "allow_registration").first()
        setting.value = "false"
        db.commit()
        
        print("Disabled registration")
        
        # Try to create new user
        user_info = {
            "email": "newuser@example.com",
            "name": "New User",
            "verified_email": True
        }
        
        try:
            create_or_get_user_from_sso(
                db=db,
                provider="google",
                external_id="google-new-123",
                user_info=user_info
            )
            print("❌ Should have raised exception for disabled registration")
            return False
        except Exception as e:
            print(f"✅ Correctly rejected new user: {e}")
            
            # Re-enable registration for other tests
            setting.value = "true"
            db.commit()
            
            return True
        
    finally:
        db.close()

def cleanup_test_db():
    """Remove test database"""
    test_db_path = Path("./test_sso_user_management.db")
    if test_db_path.exists():
        test_db_path.unlink()
        print("\n🧹 Cleaned up test database")

if __name__ == "__main__":
    print("=" * 60)
    print("SSO User Management Functions Test")
    print("=" * 60)
    
    try:
        # Setup
        setup_test_db()
        
        # Run tests
        all_passed = True
        
        all_passed &= test_create_first_user()
        all_passed &= test_create_second_user()
        all_passed &= test_get_existing_user()
        all_passed &= test_link_by_email()
        all_passed &= test_link_sso_to_user_function()
        all_passed &= test_link_email_mismatch()
        all_passed &= test_create_access_token_with_sso()
        all_passed &= test_registration_disabled()
        
        print("\n" + "=" * 60)
        if all_passed:
            print("✅ All tests passed!")
        else:
            print("❌ Some tests failed!")
            sys.exit(1)
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        cleanup_test_db()
