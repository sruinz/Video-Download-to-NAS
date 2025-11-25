#!/usr/bin/env python3
"""
Simple test script to verify SSO security utilities.
This is a basic functional test, not a comprehensive test suite.
"""

import os
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set test environment variables
os.environ["SSO_ENCRYPTION_KEY"] = "test-key-for-testing-only-not-secure-1234567890abcdef"
os.environ["DATABASE_URL"] = "sqlite:///./test_sso_security.db"

from app.sso.security import encrypt_client_secret, decrypt_client_secret, generate_state, verify_state, cleanup_expired_states
from app.database import init_db, SessionLocal, Base, engine
from datetime import datetime, timedelta

def test_encryption():
    """Test client secret encryption and decryption"""
    print("\n=== Testing Client Secret Encryption ===")
    
    # Test encryption
    original_secret = "my-super-secret-client-secret-12345"
    print(f"Original secret: {original_secret}")
    
    encrypted = encrypt_client_secret(original_secret)
    print(f"Encrypted: {encrypted}")
    
    # Test decryption
    decrypted = decrypt_client_secret(encrypted)
    print(f"Decrypted: {decrypted}")
    
    # Verify
    assert original_secret == decrypted, "Decryption failed!"
    print("✅ Encryption/Decryption test passed!")
    
    return True

def test_state_generation_and_verification():
    """Test state parameter generation and verification"""
    print("\n=== Testing State Generation and Verification ===")
    
    # Initialize database
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Test state generation
        provider = "google"
        state = generate_state(db, provider)
        print(f"Generated state: {state}")
        assert len(state) > 30, "State should be long enough"
        
        # Test state verification
        user_id = verify_state(db, state, provider)
        print(f"Verified state, user_id: {user_id}")
        assert user_id is None, "User ID should be None for login flow"
        
        print("✅ State generation and verification test passed!")
        
        # Test state with user_id (account linking)
        print("\n=== Testing State with User ID (Account Linking) ===")
        state_with_user = generate_state(db, provider, user_id=123)
        print(f"Generated state with user_id: {state_with_user}")
        
        verified_user_id = verify_state(db, state_with_user, provider)
        print(f"Verified state, user_id: {verified_user_id}")
        assert verified_user_id == 123, "User ID should be 123"
        
        print("✅ State with user_id test passed!")
        
        # Test invalid state
        print("\n=== Testing Invalid State ===")
        try:
            verify_state(db, "invalid-state-12345", provider)
            print("❌ Should have raised exception for invalid state")
            return False
        except Exception as e:
            print(f"✅ Correctly rejected invalid state: {e}")
        
        # Test wrong provider
        print("\n=== Testing Wrong Provider ===")
        state_google = generate_state(db, "google")
        try:
            verify_state(db, state_google, "microsoft")
            print("❌ Should have raised exception for wrong provider")
            return False
        except Exception as e:
            print(f"✅ Correctly rejected wrong provider: {e}")
        
        return True
        
    finally:
        db.close()

def test_expired_state_cleanup():
    """Test cleanup of expired states"""
    print("\n=== Testing Expired State Cleanup ===")
    
    db = SessionLocal()
    
    try:
        from app.database import SSOState
        
        # Create an expired state manually
        expired_state = SSOState(
            state="expired-state-12345",
            provider="google",
            user_id=None,
            expires_at=datetime.now() - timedelta(minutes=5)  # Expired 5 minutes ago
        )
        db.add(expired_state)
        db.commit()
        
        print("Created expired state")
        
        # Run cleanup
        count = cleanup_expired_states(db)
        print(f"Cleaned up {count} expired states")
        
        assert count >= 1, "Should have cleaned up at least 1 expired state"
        
        # Verify it's gone
        remaining = db.query(SSOState).filter(SSOState.state == "expired-state-12345").first()
        assert remaining is None, "Expired state should be deleted"
        
        print("✅ Expired state cleanup test passed!")
        
        return True
        
    finally:
        db.close()

def cleanup_test_db():
    """Remove test database"""
    test_db_path = Path("./test_sso_security.db")
    if test_db_path.exists():
        test_db_path.unlink()
        print("\n🧹 Cleaned up test database")

if __name__ == "__main__":
    print("=" * 60)
    print("SSO Security Utilities Test")
    print("=" * 60)
    
    try:
        # Run tests
        all_passed = True
        
        all_passed &= test_encryption()
        all_passed &= test_state_generation_and_verification()
        all_passed &= test_expired_state_cleanup()
        
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
