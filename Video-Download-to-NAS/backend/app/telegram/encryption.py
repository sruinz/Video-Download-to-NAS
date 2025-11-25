"""
텔레그램 봇 토큰 암호화/복호화 모듈
"""
from cryptography.fernet import Fernet
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class TokenEncryption:
    """봇 토큰 암호화/복호화"""
    
    def __init__(self):
        self.key = self._load_or_generate_key()
        self.cipher = Fernet(self.key)
    
    def _load_or_generate_key(self) -> bytes:
        """암호화 키 로드 또는 생성"""
        key_file = Path("/app/data/.bot_encryption_key")
        
        if key_file.exists():
            logger.info("Loading existing bot encryption key")
            return key_file.read_bytes()
        else:
            logger.info("Generating new bot encryption key")
            key = Fernet.generate_key()
            
            # 키 파일 저장
            key_file.parent.mkdir(parents=True, exist_ok=True)
            key_file.write_bytes(key)
            key_file.chmod(0o600)  # 소유자만 읽기/쓰기
            
            logger.info(f"Bot encryption key saved to {key_file}")
            return key
    
    def encrypt(self, token: str) -> str:
        """토큰 암호화"""
        if not token:
            raise ValueError("Token cannot be empty")
        
        encrypted = self.cipher.encrypt(token.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_token: str) -> str:
        """토큰 복호화"""
        if not encrypted_token:
            raise ValueError("Encrypted token cannot be empty")
        
        try:
            decrypted = self.cipher.decrypt(encrypted_token.encode())
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt token: {e}")
            raise ValueError("Invalid or corrupted encrypted token")
