"""
TokenEncryption 클래스 테스트
"""
import sys
import os
from pathlib import Path

# 테스트를 위해 임시 데이터 디렉토리 사용
test_data_dir = Path("/tmp/test_telegram_bot_data")
test_data_dir.mkdir(exist_ok=True)

# 경로 패치
original_path = Path("/app/data/.bot_encryption_key")

# app 모듈 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# 임시로 경로를 변경하여 테스트
import app.telegram.encryption as encryption_module
encryption_module.Path = lambda x: test_data_dir / ".bot_encryption_key" if "/app/data" in str(x) else Path(x)

from app.telegram.encryption import TokenEncryption


def test_encryption_key_generation():
    """암호화 키 생성 테스트"""
    print("✅ 테스트 1: 암호화 키 생성")
    
    # 기존 키 파일 삭제
    key_file = test_data_dir / ".bot_encryption_key"
    if key_file.exists():
        key_file.unlink()
    
    # TokenEncryption 인스턴스 생성 (키 자동 생성)
    encryptor = TokenEncryption()
    
    # 키 파일이 생성되었는지 확인
    assert key_file.exists(), "키 파일이 생성되지 않았습니다"
    
    # 키 파일 권한 확인 (Unix 시스템에서만)
    if os.name != 'nt':
        file_mode = oct(key_file.stat().st_mode)[-3:]
        assert file_mode == '600', f"키 파일 권한이 올바르지 않습니다: {file_mode}"
    
    print("   - 키 파일 생성 완료")
    print("   - 키 파일 권한 설정 완료 (600)")


def test_encrypt_decrypt():
    """암호화/복호화 테스트"""
    print("\n✅ 테스트 2: 토큰 암호화 및 복호화")
    
    encryptor = TokenEncryption()
    
    # 테스트 토큰
    test_token = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
    
    # 암호화
    encrypted = encryptor.encrypt(test_token)
    print(f"   - 원본 토큰: {test_token}")
    print(f"   - 암호화된 토큰: {encrypted[:50]}...")
    
    # 암호화된 토큰이 원본과 다른지 확인
    assert encrypted != test_token, "암호화가 제대로 되지 않았습니다"
    
    # 복호화
    decrypted = encryptor.decrypt(encrypted)
    print(f"   - 복호화된 토큰: {decrypted}")
    
    # 복호화된 토큰이 원본과 같은지 확인
    assert decrypted == test_token, "복호화 결과가 원본과 다릅니다"
    
    print("   - 암호화/복호화 성공")


def test_key_persistence():
    """키 지속성 테스트 (재시작 시 동일한 키 사용)"""
    print("\n✅ 테스트 3: 키 지속성")
    
    # 첫 번째 인스턴스
    encryptor1 = TokenEncryption()
    test_token = "test_token_123"
    encrypted1 = encryptor1.encrypt(test_token)
    
    # 두 번째 인스턴스 (재시작 시뮬레이션)
    encryptor2 = TokenEncryption()
    
    # 두 번째 인스턴스로 복호화
    decrypted = encryptor2.decrypt(encrypted1)
    
    assert decrypted == test_token, "재시작 후 복호화 실패"
    print("   - 재시작 후에도 동일한 키로 복호화 성공")


def test_empty_token_error():
    """빈 토큰 에러 처리 테스트"""
    print("\n✅ 테스트 4: 빈 토큰 에러 처리")
    
    encryptor = TokenEncryption()
    
    # 빈 토큰 암호화 시도
    try:
        encryptor.encrypt("")
        assert False, "빈 토큰에 대한 에러가 발생하지 않았습니다"
    except ValueError as e:
        print(f"   - 빈 토큰 암호화 에러: {e}")
    
    # 빈 암호화 토큰 복호화 시도
    try:
        encryptor.decrypt("")
        assert False, "빈 암호화 토큰에 대한 에러가 발생하지 않았습니다"
    except ValueError as e:
        print(f"   - 빈 암호화 토큰 복호화 에러: {e}")


def test_invalid_encrypted_token():
    """잘못된 암호화 토큰 에러 처리 테스트"""
    print("\n✅ 테스트 5: 잘못된 암호화 토큰 에러 처리")
    
    encryptor = TokenEncryption()
    
    # 잘못된 암호화 토큰
    invalid_token = "invalid_encrypted_token_123"
    
    try:
        encryptor.decrypt(invalid_token)
        assert False, "잘못된 토큰에 대한 에러가 발생하지 않았습니다"
    except ValueError as e:
        print(f"   - 잘못된 토큰 복호화 에러: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("TokenEncryption 클래스 테스트 시작")
    print("=" * 60)
    
    try:
        test_encryption_key_generation()
        test_encrypt_decrypt()
        test_key_persistence()
        test_empty_token_error()
        test_invalid_encrypted_token()
        
        print("\n" + "=" * 60)
        print("✅ 모든 테스트 통과!")
        print("=" * 60)
        
        # 테스트 데이터 정리
        import shutil
        shutil.rmtree(test_data_dir)
        
    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 예상치 못한 에러: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
