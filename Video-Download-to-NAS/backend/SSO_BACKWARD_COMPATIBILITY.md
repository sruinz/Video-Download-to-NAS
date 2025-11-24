# SSO 하위 호환성 가이드

## 개요

SSO 인증 기능은 기존 로컬 인증 시스템과 완벽하게 호환되도록 설계되었습니다. 기존 사용자는 아무런 영향 없이 계속 로그인할 수 있으며, SSO와 로컬 인증을 동시에 사용할 수 있습니다.

## 주요 호환성 기능

### 1. 기존 사용자 자동 마이그레이션

SSO 기능이 활성화되면 기존 사용자는 자동으로 마이그레이션됩니다:

```python
# migrations.py - migrate_sso_schema()
UPDATE users 
SET auth_provider = 'local', email_verified = 1
WHERE auth_provider IS NULL OR auth_provider = ''
```

**마이그레이션 내용:**
- `auth_provider`: 'local'로 설정 (로컬 인증 사용자임을 표시)
- `email_verified`: 1로 설정 (기존 사용자는 검증된 것으로 간주)

**영향:**
- 기존 사용자의 로그인에 영향 없음
- 기존 비밀번호 그대로 사용 가능
- 모든 기능 정상 작동

### 2. 로컬 인증 유지

#### `/api/login` 엔드포인트 유지

기존 로그인 엔드포인트는 그대로 유지됩니다:

```python
@app.post("/api/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, user_login: UserLogin, db: Session = Depends(get_db)):
    """Login endpoint with rate limiting"""
    user = authenticate_user(db, user_login.id, user_login.pw)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}
```

#### `authenticate_user()` 함수 동작

`authenticate_user()` 함수는 `auth_provider`에 관계없이 모든 사용자를 인증합니다:

```python
def authenticate_user(db: Session, username: str, password: str):
    """
    Authenticate user with username and password.
    Works for all users regardless of auth_provider (local, SSO, etc.)
    SSO users can still use local authentication if they have set a password.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return False
    
    # Verify password - works for both local and SSO users
    if not verify_password(password, user.hashed_password):
        return False
    
    return user
```

**지원되는 시나리오:**
1. **로컬 사용자**: 기존과 동일하게 로그인
2. **SSO 사용자**: SSO로 생성되었지만 비밀번호를 설정한 경우 로컬 로그인 가능
3. **혼합 사용자**: SSO와 로컬 인증 모두 사용 가능

### 3. 비밀번호 변경 기능 유지

#### 사용자 자신의 비밀번호 변경

`PUT /api/users/me` 엔드포인트는 모든 사용자에게 작동합니다:

```python
@router.put("/me", response_model=UserInfo)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user information.
    
    Password changes work for all users regardless of auth_provider:
    - Local users: Can change their password normally
    - SSO users: Can set/change password to enable local authentication fallback
    
    Changing password does not affect SSO authentication or account linking.
    """
    # ... password change logic
```

**동작 방식:**
- **로컬 사용자**: 기존 비밀번호 확인 후 새 비밀번호로 변경
- **SSO 사용자**: 비밀번호를 설정하여 로컬 인증 활성화 가능
- **SSO 연동에 영향 없음**: 비밀번호 변경해도 SSO 로그인은 계속 작동

#### 관리자의 비밀번호 변경

`PUT /api/users/admin/users/{user_id}/password` 엔드포인트도 동일하게 작동:

```python
@router.put("/admin/users/{user_id}/password")
async def admin_change_password(
    user_id: int,
    password_data: dict,
    current_user: User = Depends(require_role(["super_admin", "admin"])),
    db: Session = Depends(get_db)
):
    """
    Change user password (admin only).
    
    Works for all users regardless of auth_provider:
    - Local users: Updates their password
    - SSO users: Sets/updates password to enable local authentication fallback
    
    Changing password does not affect SSO authentication or account linking.
    """
    # ... password change logic
```

## 사용 시나리오

### 시나리오 1: 기존 로컬 사용자

**상황**: SSO 기능 활성화 전부터 사용하던 사용자

**동작**:
1. 자동으로 `auth_provider='local'`로 마이그레이션
2. 기존 비밀번호로 계속 로그인 가능
3. 원하면 SSO 계정 연동 가능 (계정 설정에서)
4. SSO 연동 후에도 로컬 로그인 계속 가능

### 시나리오 2: SSO로 생성된 사용자

**상황**: Google/Microsoft/GitHub로 처음 로그인한 사용자

**동작**:
1. `auth_provider='google'` (또는 microsoft, github)로 생성
2. 무작위 해시 비밀번호 자동 생성 (로컬 로그인 불가)
3. 계정 설정에서 비밀번호 설정 가능
4. 비밀번호 설정 후 로컬 로그인 가능
5. SSO 로그인도 계속 작동

### 시나리오 3: 로컬 사용자가 SSO 연동

**상황**: 로컬 계정을 가진 사용자가 Google 계정 연동

**동작**:
1. 계정 설정에서 "Google 연동하기" 클릭
2. Google 인증 완료 후 이메일 일치 확인
3. `auth_provider='google'`, `external_id` 저장
4. 이후 Google 로그인 또는 로컬 로그인 모두 가능
5. 비밀번호 변경해도 Google 로그인에 영향 없음

### 시나리오 4: SSO 사용자가 비밀번호 설정

**상황**: Google로 가입한 사용자가 로컬 인증도 사용하고 싶음

**동작**:
1. 계정 설정에서 "비밀번호 변경" 클릭
2. 현재 비밀번호 입력 (초기 무작위 비밀번호는 모름)
3. 관리자에게 비밀번호 재설정 요청
4. 관리자가 임시 비밀번호 설정
5. 사용자가 로그인 후 비밀번호 변경
6. 이후 로컬 로그인 가능

**또는**:
1. 관리자가 직접 사용자 비밀번호 설정
2. 사용자에게 비밀번호 전달
3. 사용자가 로컬 로그인 가능

## 데이터베이스 스키마

### Users 테이블 SSO 필드

```sql
-- SSO 관련 필드
auth_provider VARCHAR(50) DEFAULT 'local' NOT NULL  -- 'local', 'google', 'microsoft', 'github', etc.
external_id VARCHAR(255)                             -- OAuth2 provider's user ID
email_verified INTEGER DEFAULT 0 NOT NULL            -- 0 = not verified, 1 = verified

-- 인덱스
CREATE INDEX idx_auth_provider ON users(auth_provider);
CREATE INDEX idx_external_id ON users(external_id);
CREATE INDEX idx_auth_provider_external_id ON users(auth_provider, external_id);
```

### 필드 의미

- **auth_provider**: 사용자가 어떤 방식으로 인증하는지 표시
  - `'local'`: 로컬 인증 (아이디/비밀번호)
  - `'google'`: Google SSO
  - `'microsoft'`: Microsoft SSO
  - `'github'`: GitHub SSO
  - 기타 SSO 제공자

- **external_id**: SSO 제공자의 사용자 고유 ID
  - 로컬 사용자는 NULL
  - SSO 사용자는 제공자의 user ID 저장

- **email_verified**: 이메일 인증 여부
  - 로컬 사용자: 기본 1 (기존 사용자는 검증된 것으로 간주)
  - SSO 사용자: 1 (SSO 제공자가 이메일 검증)

## API 호환성

### 기존 API 엔드포인트

모든 기존 API 엔드포인트는 변경 없이 작동합니다:

- `POST /api/login` - 로컬 로그인
- `POST /api/users/register` - 사용자 등록
- `GET /api/users/me` - 현재 사용자 정보
- `PUT /api/users/me` - 사용자 정보 수정 (비밀번호 변경 포함)
- `GET /api/library` - 라이브러리 조회
- `POST /api/download` - 다운로드 시작
- 기타 모든 엔드포인트

### 새로운 SSO API 엔드포인트

SSO 기능을 위한 새 엔드포인트가 추가되었지만, 기존 기능에 영향 없음:

- `GET /api/sso/providers` - 활성화된 SSO 제공자 목록
- `GET /api/sso/{provider}/login` - SSO 로그인 시작
- `GET /api/sso/{provider}/callback` - SSO 콜백 처리
- `POST /api/sso/{provider}/link` - SSO 계정 연동
- `DELETE /api/sso/{provider}/unlink` - SSO 연동 해제
- `GET /api/admin/sso/settings` - SSO 설정 조회 (관리자)
- `PUT /api/admin/sso/settings/{provider}` - SSO 설정 업데이트 (관리자)

## 프론트엔드 호환성

### 로그인 페이지

로그인 페이지는 SSO 버튼과 로컬 로그인 폼을 모두 표시:

```jsx
// SSO 버튼 (활성화된 제공자만 표시)
{ssoProviders.map(provider => (
  <SSOButton key={provider} provider={provider} />
))}

<div className="divider">또는</div>

// 기존 로컬 로그인 폼
<form onSubmit={handleLocalLogin}>
  <input type="text" placeholder="아이디" />
  <input type="password" placeholder="비밀번호" />
  <button type="submit">로그인</button>
</form>
```

### 계정 설정

계정 설정 페이지에서 SSO 연동 관리:

```jsx
// 연동된 SSO 제공자 표시
{user.auth_provider !== 'local' && (
  <div>
    <p>연동된 계정: {user.auth_provider}</p>
    <button onClick={handleUnlink}>연동 해제</button>
  </div>
)}

// 연동 가능한 SSO 제공자
{availableProviders.map(provider => (
  <button key={provider} onClick={() => handleLink(provider)}>
    {provider} 연동하기
  </button>
))}

// 비밀번호 변경 (모든 사용자 가능)
<button onClick={openChangePasswordModal}>
  비밀번호 변경
</button>
```

## 보안 고려사항

### 1. 비밀번호 해싱

모든 비밀번호는 bcrypt로 해싱되어 저장:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

### 2. SSO 사용자의 초기 비밀번호

SSO로 생성된 사용자는 무작위 해시 비밀번호를 가집니다:

```python
# sso/user_management.py
import secrets

# Generate random password that cannot be guessed
random_password = secrets.token_urlsafe(32)
hashed_password = get_password_hash(random_password)
```

이 비밀번호는:
- 사용자가 알 수 없음 (로컬 로그인 불가)
- 관리자가 재설정 가능
- 사용자가 직접 설정 가능 (현재 비밀번호 필요)

### 3. 계정 연동 시 이메일 검증

SSO 계정 연동 시 이메일 일치 확인:

```python
# sso/user_management.py
def link_sso_to_user(db: Session, user: User, provider: str, external_id: str, email: str):
    # Email must match
    if user.email != email:
        raise HTTPException(
            status_code=400,
            detail="Email mismatch. Cannot link account."
        )
    
    # Update user
    user.auth_provider = provider
    user.external_id = external_id
    db.commit()
```

## 마이그레이션 체크리스트

SSO 기능 활성화 시 확인 사항:

- [x] 기존 사용자 자동 마이그레이션 (`auth_provider='local'`)
- [x] 기존 사용자 이메일 검증 상태 설정 (`email_verified=1`)
- [x] 로컬 로그인 엔드포인트 유지 (`/api/login`)
- [x] `authenticate_user()` 함수 모든 auth_provider 지원
- [x] 비밀번호 변경 기능 모든 사용자 지원
- [x] SSO 사용자 비밀번호 설정 가능
- [x] 비밀번호 변경 시 SSO 연동 유지
- [x] 프론트엔드 로그인 페이지 SSO/로컬 모두 표시
- [x] 계정 설정 SSO 연동 관리 UI

## 문제 해결

### Q: 기존 사용자가 로그인할 수 없어요

**A**: 마이그레이션이 정상적으로 실행되었는지 확인:

```sql
-- 사용자의 auth_provider 확인
SELECT id, username, auth_provider, email_verified FROM users;

-- 'local'이 아닌 경우 수동 업데이트
UPDATE users SET auth_provider = 'local', email_verified = 1 WHERE id = ?;
```

### Q: SSO 사용자가 비밀번호를 모르는데 로컬 로그인하고 싶어요

**A**: 관리자가 비밀번호를 재설정해주세요:

1. 관리자 로그인
2. 사용자 관리 페이지
3. 해당 사용자 선택
4. "비밀번호 변경" 클릭
5. 새 비밀번호 설정
6. 사용자에게 전달

### Q: SSO 연동 후 로컬 로그인이 안 돼요

**A**: SSO 연동은 로컬 로그인에 영향을 주지 않습니다. 비밀번호가 맞는지 확인하세요.

```python
# 사용자 정보 확인
user = db.query(User).filter(User.username == "username").first()
print(f"auth_provider: {user.auth_provider}")
print(f"external_id: {user.external_id}")

# 비밀번호 검증 테스트
from app.auth import verify_password
is_valid = verify_password("password", user.hashed_password)
print(f"Password valid: {is_valid}")
```

### Q: 비밀번호 변경 후 SSO 로그인이 안 돼요

**A**: 비밀번호 변경은 SSO 로그인에 영향을 주지 않습니다. SSO 제공자 설정을 확인하세요.

## 결론

SSO 인증 기능은 기존 시스템과 완벽하게 호환되도록 설계되었습니다:

1. **기존 사용자**: 아무런 영향 없이 계속 사용 가능
2. **로컬 인증**: 계속 지원되며 SSO와 병행 가능
3. **비밀번호 관리**: 모든 사용자가 비밀번호 설정/변경 가능
4. **유연성**: 로컬 인증과 SSO 인증을 자유롭게 선택 가능

사용자는 자신에게 편한 방식으로 로그인할 수 있으며, 필요에 따라 여러 인증 방식을 동시에 사용할 수 있습니다.
