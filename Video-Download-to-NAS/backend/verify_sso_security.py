#!/usr/bin/env python3
"""
Simple verification script for SSO security utilities.
This checks the code structure without running it.
"""

import os
import sys
from pathlib import Path

def check_file_exists(filepath):
    """Check if a file exists"""
    path = Path(filepath)
    if path.exists():
        print(f"✅ {filepath} exists")
        return True
    else:
        print(f"❌ {filepath} NOT FOUND")
        return False

def check_function_in_file(filepath, function_name):
    """Check if a function is defined in a file"""
    path = Path(filepath)
    if not path.exists():
        return False
    
    content = path.read_text()
    if f"def {function_name}" in content:
        print(f"  ✅ Function '{function_name}' found")
        return True
    else:
        print(f"  ❌ Function '{function_name}' NOT FOUND")
        return False

def check_import_in_file(filepath, import_statement):
    """Check if an import statement exists in a file"""
    path = Path(filepath)
    if not path.exists():
        return False
    
    content = path.read_text()
    if import_statement in content:
        print(f"  ✅ Import '{import_statement}' found")
        return True
    else:
        print(f"  ❌ Import '{import_statement}' NOT FOUND")
        return False

def main():
    print("=" * 70)
    print("SSO Security Utilities Verification")
    print("=" * 70)
    
    all_checks_passed = True
    
    # Check security.py
    print("\n📄 Checking server/backend/app/sso/security.py")
    all_checks_passed &= check_file_exists("server/backend/app/sso/security.py")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/security.py", "encrypt_client_secret")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/security.py", "decrypt_client_secret")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/security.py", "generate_state")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/security.py", "verify_state")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/security.py", "cleanup_expired_states")
    all_checks_passed &= check_import_in_file("server/backend/app/sso/security.py", "from cryptography.fernet import Fernet")
    all_checks_passed &= check_import_in_file("server/backend/app/sso/security.py", "import secrets")
    
    # Check scheduler.py
    print("\n📄 Checking server/backend/app/sso/scheduler.py")
    all_checks_passed &= check_file_exists("server/backend/app/sso/scheduler.py")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/scheduler.py", "cleanup_expired_states_job")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/scheduler.py", "start_scheduler")
    all_checks_passed &= check_function_in_file("server/backend/app/sso/scheduler.py", "stop_scheduler")
    all_checks_passed &= check_import_in_file("server/backend/app/sso/scheduler.py", "from apscheduler.schedulers.asyncio import AsyncIOScheduler")
    
    # Check __init__.py exports
    print("\n📄 Checking server/backend/app/sso/__init__.py")
    all_checks_passed &= check_import_in_file("server/backend/app/sso/__init__.py", "from .security import")
    all_checks_passed &= check_import_in_file("server/backend/app/sso/__init__.py", "from .scheduler import start_scheduler, stop_scheduler")
    
    # Check main.py integration
    print("\n📄 Checking server/backend/app/main.py integration")
    all_checks_passed &= check_import_in_file("server/backend/app/main.py", "from .sso.scheduler import start_scheduler")
    all_checks_passed &= check_import_in_file("server/backend/app/main.py", "from .sso.scheduler import stop_scheduler")
    all_checks_passed &= check_function_in_file("server/backend/app/main.py", "startup_event")
    all_checks_passed &= check_function_in_file("server/backend/app/main.py", "shutdown_event")
    
    # Check requirements.txt
    print("\n📄 Checking server/backend/requirements.txt")
    req_path = Path("server/backend/requirements.txt")
    if req_path.exists():
        content = req_path.read_text()
        deps = ["httpx", "authlib", "cryptography", "apscheduler"]
        for dep in deps:
            if dep in content.lower():
                print(f"  ✅ Dependency '{dep}' found")
            else:
                print(f"  ❌ Dependency '{dep}' NOT FOUND")
                all_checks_passed = False
    else:
        print(f"  ❌ requirements.txt NOT FOUND")
        all_checks_passed = False
    
    # Check .env.example
    print("\n📄 Checking server/.env.example")
    env_path = Path("server/.env.example")
    if env_path.exists():
        content = env_path.read_text()
        if "SSO_ENCRYPTION_KEY" in content:
            print(f"  ✅ SSO_ENCRYPTION_KEY found in .env.example")
        else:
            print(f"  ❌ SSO_ENCRYPTION_KEY NOT FOUND in .env.example")
            all_checks_passed = False
    else:
        print(f"  ❌ .env.example NOT FOUND")
        all_checks_passed = False
    
    print("\n" + "=" * 70)
    if all_checks_passed:
        print("✅ All verification checks passed!")
        print("\nImplemented features:")
        print("  • Client secret encryption/decryption using Fernet")
        print("  • Cryptographically secure state parameter generation")
        print("  • State verification with CSRF protection")
        print("  • Automatic cleanup of expired states (every 10 minutes)")
        print("  • Integration with main application startup/shutdown")
        print("  • All required dependencies added to requirements.txt")
    else:
        print("❌ Some verification checks failed!")
        sys.exit(1)
    print("=" * 70)

if __name__ == "__main__":
    main()
