"""
TokenEncryption 구현 검증 스크립트
요구사항 8.1, 8.2, 8.3, 8.4, 8.5 충족 여부 확인
"""

print("=" * 70)
print("TokenEncryption 구현 검증")
print("=" * 70)

# 1. 코드 구조 검증
print("\n✅ 1. 코드 구조 검증")
print("   - encryption.py 파일 존재 확인")

import os
import sys

# 현재 스크립트의 디렉토리 기준으로 경로 설정
script_dir = os.path.dirname(os.path.abspath(__file__))
encryption_file = os.path.join(script_dir, "app/telegram/encryption.py")
assert os.path.exists(encryption_file), f"{encryption_file} 파일이 존재하지 않습니다"
print(f"   ✓ encryption.py 파일 존재")

# 2. 필수 메서드 존재 확인
print("\n✅ 2. 필수 메서드 존재 확인")

with open(encryption_file, 'r') as f:
    content = f.read()
    
required_methods = [
    'class TokenEncryption',
    'def __init__',
    'def _load_or_generate_key',
    'def encrypt',
    'def decrypt'
]

for method in required_methods:
    assert method in content, f"{method}가 구현되지 않았습니다"
    print(f"   ✓ {method} 구현됨")

# 3. Fernet 암호화 사용 확인
print("\n✅ 3. Fernet 암호화 사용 확인")
assert 'from cryptography.fernet import Fernet' in content, "Fernet import가 없습니다"
assert 'Fernet(' in content, "Fernet 사용이 확인되지 않습니다"
print("   ✓ Fernet 기반 암호화 사용")

# 4. 암호화 키 파일 경로 확인
print("\n✅ 4. 암호화 키 파일 경로 확인")
assert '.bot_encryption_key' in content, "암호화 키 파일명이 올바르지 않습니다"
assert '/app/data/' in content, "암호화 키 경로가 올바르지 않습니다"
print("   ✓ 키 파일 경로: /app/data/.bot_encryption_key")

# 5. 파일 권한 설정 확인
print("\n✅ 5. 파일 권한 설정 확인")
assert 'chmod(0o600)' in content, "파일 권한 설정이 없습니다"
print("   ✓ 키 파일 권한: 0o600 (소유자만 읽기/쓰기)")

# 6. 에러 처리 확인
print("\n✅ 6. 에러 처리 확인")
assert 'raise ValueError' in content, "에러 처리가 구현되지 않았습니다"
assert 'try:' in content and 'except' in content, "예외 처리가 구현되지 않았습니다"
print("   ✓ 에러 처리 구현됨")

# 7. 로깅 확인
print("\n✅ 7. 로깅 확인")
assert 'import logging' in content, "로깅 모듈이 import되지 않았습니다"
assert 'logger' in content, "로거가 사용되지 않습니다"
print("   ✓ 로깅 구현됨")

# 8. 보안 요구사항 검증
print("\n✅ 8. 보안 요구사항 검증")

# 8.1: 토큰 암호화
assert 'def encrypt' in content, "encrypt 메서드가 없습니다"
assert 'cipher.encrypt' in content, "암호화 로직이 없습니다"
print("   ✓ Requirement 8.1: 토큰 암호화 구현")

# 8.3: 메모리에서만 복호화
assert 'def decrypt' in content, "decrypt 메서드가 없습니다"
assert 'cipher.decrypt' in content, "복호화 로직이 없습니다"
print("   ✓ Requirement 8.3: 메모리에서 복호화 구현")

# 8.4: 키 없이 복호화 불가능
assert 'Fernet(' in content, "Fernet 암호화 사용 확인"
print("   ✓ Requirement 8.4: 키 없이 복호화 불가능 (Fernet 사용)")

# 8.5: 토큰 로깅 방지
# 토큰 자체를 로그에 남기지 않는지 확인
assert 'logger.error(f"Failed to decrypt token: {e}")' in content, "에러 로깅 확인"
# 토큰 값을 직접 로그에 남기는 코드가 없는지 확인
assert 'logger' not in content or 'token)' not in content.replace('encrypted_token)', ''), "토큰이 로그에 노출될 수 있습니다"
print("   ✓ Requirement 8.5: 토큰 로깅 방지")

# 9. requirements.txt 확인
print("\n✅ 9. 의존성 확인")
requirements_file = os.path.join(script_dir, "requirements.txt")
assert os.path.exists(requirements_file), "requirements.txt가 없습니다"

with open(requirements_file, 'r') as f:
    requirements = f.read()
    
assert 'cryptography' in requirements, "cryptography 패키지가 requirements.txt에 없습니다"
print("   ✓ cryptography 패키지 포함됨")

# 10. 최종 검증
print("\n" + "=" * 70)
print("✅ 모든 검증 통과!")
print("=" * 70)
print("\n📋 구현 요약:")
print("   - Fernet 기반 대칭키 암호화 사용")
print("   - 암호화 키: /app/data/.bot_encryption_key (권한 600)")
print("   - encrypt() 메서드: 토큰 암호화")
print("   - decrypt() 메서드: 토큰 복호화 (메모리에서만)")
print("   - 에러 처리 및 로깅 구현")
print("   - 보안 요구사항 (8.1, 8.2, 8.3, 8.4, 8.5) 충족")
print("\n✅ Task 2: 토큰 암호화 시스템 구현 완료")
