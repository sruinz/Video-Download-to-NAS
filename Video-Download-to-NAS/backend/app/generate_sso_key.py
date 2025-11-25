#!/usr/bin/env python3
"""
Generate SSO encryption key for VDTN
This key is used to encrypt OAuth2 client secrets in the database
"""

from cryptography.fernet import Fernet

if __name__ == "__main__":
    key = Fernet.generate_key().decode()
    print("\n" + "="*60)
    print("SSO Encryption Key Generated")
    print("="*60)
    print("\nAdd this to your .env file:")
    print(f"\nSSO_ENCRYPTION_KEY={key}")
    print("\n" + "="*60)
    print("\n⚠️  IMPORTANT: Keep this key secure and never commit it to git!")
    print("⚠️  If you lose this key, you'll need to reconfigure all SSO providers.")
    print("\n")
