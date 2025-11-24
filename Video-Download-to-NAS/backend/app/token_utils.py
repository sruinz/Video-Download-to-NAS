"""
API Token Utilities

Functions for generating, hashing, and verifying API tokens
"""
import secrets
import string
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_api_token() -> str:
    """
    Generate a secure API token
    Format: vdtn_{32_random_chars}
    
    Returns:
        str: Generated token (e.g., "vdtn_abc123def456...")
    """
    random_part = ''.join(
        secrets.choice(string.ascii_letters + string.digits) 
        for _ in range(32)
    )
    return f"vdtn_{random_part}"


def hash_token(token: str) -> str:
    """
    Hash token using bcrypt
    
    Args:
        token: Plain text token
        
    Returns:
        str: Bcrypt hashed token
    """
    return pwd_context.hash(token)


def verify_token_hash(plain_token: str, hashed_token: str) -> bool:
    """
    Verify token against hash
    
    Args:
        plain_token: Plain text token to verify
        hashed_token: Bcrypt hashed token from database
        
    Returns:
        bool: True if token matches hash, False otherwise
    """
    return pwd_context.verify(plain_token, hashed_token)


def get_token_prefix(token: str, prefix_length: int = 12, suffix_length: int = 3) -> str:
    """
    Get displayable token prefix for UI
    Shows first N and last M characters with ellipsis in between
    
    Example: 
        vdtn_abc123def456ghi789jkl012mno345 → vdtn_abc123...345
    
    Args:
        token: Full token string
        prefix_length: Number of characters to show at start (default 12)
        suffix_length: Number of characters to show at end (default 3)
        
    Returns:
        str: Masked token string
    """
    if len(token) <= prefix_length + suffix_length + 3:
        return token
    
    return f"{token[:prefix_length]}...{token[-suffix_length:]}"
