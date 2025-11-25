# SSO Security Utilities Implementation

## Overview

This document describes the implementation of Task 3 "보안 및 암호화 유틸리티" from the SSO authentication specification.

## Implemented Components

### 1. Client Secret Encryption/Decryption (`app/sso/security.py`)

**Functions:**
- `encrypt_client_secret(secret: str) -> str`
  - Encrypts OAuth2 client secrets using Fernet symmetric encryption
  - Uses `SSO_ENCRYPTION_KEY` environment variable
  - Returns base64-encoded encrypted string
  
- `decrypt_client_secret(encrypted_secret: str) -> str`
  - Decrypts previously encrypted client secrets
  - Validates encryption key availability
  - Handles decryption errors gracefully

**Security Features:**
- Uses Fernet (symmetric encryption) from the `cryptography` library
- Encryption key must be set in environment variables
- Proper error handling with HTTP exceptions
- Logging for security audit trail

### 2. State Parameter Generation and Verification (`app/sso/security.py`)

**Functions:**
- `generate_state(db: Session, provider: str, user_id: Optional[int] = None) -> str`
  - Generates cryptographically secure random state (32 bytes = 43 characters)
  - Stores state in database with 10-minute expiration
  - Supports optional user_id for account linking flows
  - Uses Python's `secrets` module for cryptographic randomness
  
- `verify_state(db: Session, state: str, provider: str) -> Optional[int]`
  - Validates state parameter against database
  - Checks provider match
  - Verifies expiration time
  - Deletes state after verification (one-time use)
  - Returns user_id if present (for account linking)
  
- `cleanup_expired_states(db: Session) -> int`
  - Removes expired state entries from database
  - Returns count of deleted entries
  - Prevents database bloat

**Security Features:**
- CSRF attack prevention through state validation
- One-time use tokens (deleted after verification)
- Time-based expiration (10 minutes)
- Provider validation to prevent cross-provider attacks
- Cryptographically secure random generation

### 3. Automatic State Cleanup Scheduler (`app/sso/scheduler.py`)

**Components:**
- `cleanup_expired_states_job()`
  - Background job that runs every 10 minutes
  - Calls `cleanup_expired_states()` to remove old entries
  - Logs cleanup activity
  
- `start_scheduler()`
  - Initializes APScheduler with AsyncIO support
  - Schedules cleanup job with 10-minute interval
  - Called during application startup
  
- `stop_scheduler()`
  - Gracefully shuts down scheduler
  - Called during application shutdown

**Features:**
- Automatic maintenance without manual intervention
- Prevents database bloat from expired states
- Configurable interval (currently 10 minutes)
- Proper startup/shutdown lifecycle management

## Integration Points

### 1. Main Application (`app/main.py`)

**Startup Event:**
```python
@app.on_event("startup")
async def startup_event():
    # ... existing code ...
    start_scheduler()  # Start SSO state cleanup
```

**Shutdown Event:**
```python
@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()  # Stop SSO state cleanup
```

### 2. SSO Module Exports (`app/sso/__init__.py`)

All security functions are exported for use by other modules:
- `encrypt_client_secret`
- `decrypt_client_secret`
- `generate_state`
- `verify_state`
- `cleanup_expired_states`
- `start_scheduler`
- `stop_scheduler`

### 3. Dependencies (`requirements.txt`)

Added required packages:
- `httpx==0.27.0` - Async HTTP client for OAuth2
- `authlib==1.3.0` - OAuth2 library
- `cryptography==42.0.0` - Encryption utilities
- `apscheduler==3.10.4` - Background job scheduler

### 4. Environment Configuration (`.env.example`)

Added SSO-related environment variables:
- `SSO_ENCRYPTION_KEY` - Fernet encryption key for client secrets
- `BACKEND_URL` - Backend URL for OAuth2 redirects
- `FRONTEND_URL` - Frontend URL for post-auth redirects
- `FORCE_HTTPS` - Force HTTPS for production

## Usage Examples

### Encrypting a Client Secret

```python
from app.sso import encrypt_client_secret, decrypt_client_secret

# Encrypt
client_secret = "my-oauth2-client-secret"
encrypted = encrypt_client_secret(client_secret)

# Store encrypted value in database
sso_settings.client_secret_encrypted = encrypted

# Later, decrypt when needed
decrypted = decrypt_client_secret(sso_settings.client_secret_encrypted)
```

### Generating and Verifying State

```python
from app.sso import generate_state, verify_state

# Generate state for OAuth2 flow
state = generate_state(db, provider="google")

# Redirect user to OAuth2 provider with state parameter
redirect_url = f"https://accounts.google.com/o/oauth2/v2/auth?state={state}&..."

# Later, in callback handler
user_id = verify_state(db, received_state, provider="google")
# user_id will be None for login, or an integer for account linking
```

### Account Linking Flow

```python
# When user wants to link their account
state = generate_state(db, provider="google", user_id=current_user.id)

# After OAuth2 callback
linked_user_id = verify_state(db, received_state, provider="google")
# linked_user_id will be the current_user.id
```

## Security Considerations

1. **Encryption Key Management**
   - `SSO_ENCRYPTION_KEY` must be kept secret
   - Generate using: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - Never commit to version control
   - Rotate periodically in production

2. **State Parameter Security**
   - 32 bytes of cryptographic randomness
   - One-time use (deleted after verification)
   - 10-minute expiration window
   - Provider validation prevents cross-provider attacks

3. **Database Security**
   - Client secrets stored encrypted
   - State parameters automatically cleaned up
   - Proper indexing for performance

4. **Error Handling**
   - All functions raise HTTPException on errors
   - Detailed logging for security audit
   - User-friendly error messages

## Testing

A verification script is provided at `server/backend/verify_sso_security.py` that checks:
- All required files exist
- All required functions are defined
- All required imports are present
- Dependencies are in requirements.txt
- Environment variables are documented

Run verification:
```bash
python3 server/backend/verify_sso_security.py
```

## Requirements Mapping

This implementation satisfies the following requirements from the specification:

- **Requirement 8.1**: State parameter generation for CSRF protection
- **Requirement 8.2**: State parameter verification in callbacks
- **Requirement 8.4**: Client secret encryption in database

## Next Steps

The security utilities are now ready for use in:
- Task 4: SSO 인증 라우터 구현
- Task 5: SSO 설정 관리 라우터 구현
- Task 6: 사용자 계정 관리 로직

These tasks will use the security functions to implement the complete SSO authentication flow.
