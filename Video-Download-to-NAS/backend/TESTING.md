# SSO 인증 테스트 가이드

## 개요

이 문서는 SSO 인증 시스템의 테스트 실행 방법을 설명합니다.

## 테스트 파일 구조

```
server/backend/
├── test_oauth_providers.py          # OAuth2 Provider 단위 테스트
├── test_sso_auth_logic.py           # SSO 인증 로직 테스트
├── test_sso_integration.py          # SSO 통합 테스트
├── test_sso_error_handling.py       # SSO 에러 처리 테스트
├── test_sso_security.py             # SSO 보안 유틸리티 테스트
└── test_sso_user_management.py      # SSO 사용자 관리 테스트
```

## 테스트 환경 설정

### 1. 의존성 설치

```bash
cd backend
pip install -r requirements.txt
```

requirements.txt에는 다음 테스트 의존성이 포함되어 있습니다:
- pytest==8.0.0
- pytest-asyncio==0.23.0

### 2. 환경 변수 설정

테스트는 자동으로 테스트용 환경 변수를 설정하지만, 필요시 `.env.test` 파일을 생성할 수 있습니다:

```bash
SSO_ENCRYPTION_KEY=test-key-for-testing-only-not-secure-1234567890abcdef
DATABASE_URL=sqlite:///./test.db
JWT_SECRET=test-jwt-secret-for-testing-only
FRONTEND_URL=http://localhost:3000
```

## 테스트 실행

### 모든 테스트 실행

```bash
# pytest 사용
python -m pytest -v

# 또는 특정 패턴의 테스트만
python -m pytest test_sso_*.py -v
```

### 개별 테스트 파일 실행

#### 1. OAuth2 Provider 단위 테스트

```bash
python -m pytest test_oauth_providers.py -v
```

**테스트 내용:**
- GoogleProvider 초기화 및 메서드 테스트
- MicrosoftProvider 초기화 및 메서드 테스트
- GitHubProvider 초기화 및 메서드 테스트
- GenericOIDCProvider 초기화 및 메서드 테스트

**요구사항:** 2.1, 3.1, 4.1

#### 2. SSO 인증 로직 테스트

```bash
python -m pytest test_sso_auth_logic.py -v
```

**테스트 내용:**
- 사용자 생성 (첫 번째 사용자는 super_admin)
- 기존 사용자 조회
- 이메일 기반 계정 연동
- State 생성 및 검증
- JWT 토큰 생성

**요구사항:** 5.1, 6.1, 8.1, 8.2

#### 3. SSO 통합 테스트

```bash
python -m pytest test_sso_integration.py -v
```

**테스트 내용:**
- 전체 SSO 로그인 플로우
- 계정 연동 플로우
- CSRF 공격 방지 (State 검증)
- 등록 제어

**요구사항:** 1.1, 1.2, 1.3, 6.1, 6.2, 8.1, 8.2

#### 4. SSO 에러 처리 테스트

```bash
python -m pytest test_sso_error_handling.py -v

# 또는 직접 실행
python test_sso_error_handling.py
```

**테스트 내용:**
- 모든 SSO 예외 클래스 테스트
- 사용자 친화적 에러 메시지 검증

**요구사항:** 9.1, 9.2, 9.3, 9.4

#### 5. SSO 보안 유틸리티 테스트

```bash
python test_sso_security.py
```

**테스트 내용:**
- Client Secret 암호화/복호화
- State 생성 및 검증
- 만료된 State 정리

#### 6. SSO 사용자 관리 테스트

```bash
python test_sso_user_management.py
```

**테스트 내용:**
- SSO를 통한 사용자 생성
- 계정 연동 함수
- JWT 토큰 생성 (SSO 정보 포함)

## 테스트 커버리지

### 커버리지 측정

```bash
# pytest-cov 설치
pip install pytest-cov

# 커버리지 측정
python -m pytest --cov=app.sso --cov-report=html

# 결과 확인
open htmlcov/index.html
```

### 목표 커버리지

- **OAuth2 Providers:** 80% 이상
- **SSO 인증 로직:** 90% 이상
- **보안 유틸리티:** 95% 이상
- **에러 처리:** 100%

## 테스트 작성 가이드

### 단위 테스트 작성

```python
import pytest
from app.sso.google_provider import GoogleProvider

class TestGoogleProvider:
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.provider = GoogleProvider(
            client_id="test-id",
            client_secret="test-secret",
            redirect_uri="http://localhost/callback"
        )
    
    def test_something(self):
        """테스트 설명"""
        # Arrange
        expected = "expected_value"
        
        # Act
        result = self.provider.some_method()
        
        # Assert
        assert result == expected
```

### 비동기 테스트 작성

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    """비동기 함수 테스트"""
    result = await some_async_function()
    assert result is not None
```

### Mock 사용

```python
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_with_mock():
    """Mock을 사용한 테스트"""
    mock_response = MagicMock()
    mock_response.json.return_value = {"key": "value"}
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )
        
        result = await function_that_uses_httpx()
        assert result["key"] == "value"
```

## 문제 해결

### pytest를 찾을 수 없음

```bash
# pip로 pytest 설치
pip install pytest pytest-asyncio

# 또는 requirements.txt 재설치
pip install -r requirements.txt
```

### 데이터베이스 에러

테스트는 자동으로 임시 SQLite 데이터베이스를 생성하고 정리합니다. 
만약 문제가 발생하면 수동으로 테스트 DB 파일을 삭제하세요:

```bash
rm test_*.db
```

### Import 에러

```bash
# PYTHONPATH 설정
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# 또는 테스트 실행 시
PYTHONPATH=. python -m pytest
```

### 비동기 테스트 에러

pytest-asyncio가 설치되어 있는지 확인:

```bash
pip install pytest-asyncio
```

## 시놀로지 NAS에서 테스트 실행

### 방법 1: Docker 컨테이너 내부에서 실행 (권장)

이미 빌드된 컨테이너 안에서 테스트를 실행합니다.

```bash
# 1. SSH로 시놀로지 접속
ssh admin@your-nas-ip

# 2. 실행 중인 backend 컨테이너 확인
sudo docker ps | grep backend

# 3. 컨테이너 내부로 접속
sudo docker exec -it video-download-to-nas-backend-1 /bin/bash

# 4. 컨테이너 내부에서 테스트 실행
cd /app
python -m pytest test_sso_*.py -v

# 5. 특정 테스트만 실행
python -m pytest test_oauth_providers.py -v

# 6. 컨테이너에서 나가기
exit
```

**장점:**
- 프로덕션 환경과 동일한 환경에서 테스트
- 의존성 설치 불필요 (이미 컨테이너에 포함)
- 시놀로지 시스템에 영향 없음

### 방법 2: 테스트 전용 컨테이너 실행

테스트만을 위한 임시 컨테이너를 실행합니다.

```bash
# SSH로 시놀로지 접속
ssh admin@your-nas-ip
cd /volume1/docker/video-download-to-nas

# 테스트 전용 컨테이너 실행
sudo docker-compose run --rm backend python -m pytest test_sso_*.py -v

# 또는 특정 테스트만
sudo docker-compose run --rm backend python -m pytest test_oauth_providers.py -v
```

**장점:**
- 실행 중인 서비스에 영향 없음
- 테스트 후 자동으로 컨테이너 삭제 (--rm)

### 방법 3: 로컬에서 테스트 후 배포

개발 환경에서 테스트를 완료한 후 시놀로지에 배포합니다.

```bash
# 로컬 머신에서 테스트
cd backend
python -m pytest test_sso_*.py -v

# 테스트 통과 후 시놀로지에 배포
scp -r server/* admin@your-nas-ip:/volume1/docker/video-download-to-nas/

# SSH로 접속하여 재빌드
ssh admin@your-nas-ip
cd /volume1/docker/video-download-to-nas
sudo docker-compose down
sudo docker-compose build
sudo docker-compose up -d
```

**장점:**
- 빠른 테스트 실행
- 시놀로지 리소스 절약
- 문제 발견 시 빠른 수정 가능

### 시놀로지 테스트 자동화 스크립트

테스트를 쉽게 실행할 수 있는 스크립트를 만들 수 있습니다.

```bash
# test_on_synology.sh (로컬 머신에서 실행)
#!/bin/bash

NAS_IP="your-nas-ip"
NAS_USER="admin"
PROJECT_PATH="/volume1/docker/video-download-to-nas"

echo "🧪 Running tests on Synology NAS..."

ssh $NAS_USER@$NAS_IP << EOF
cd $PROJECT_PATH
echo "📦 Running tests in Docker container..."
sudo docker-compose run --rm backend python -m pytest test_sso_*.py -v --tb=short
EOF

echo "✅ Tests completed!"
```

사용법:
```bash
chmod +x test_on_synology.sh
./test_on_synology.sh
```

### 테스트 결과 로그 저장

```bash
# 컨테이너 내부에서 테스트 실행 및 로그 저장
sudo docker exec video-download-to-nas-backend-1 \
  python -m pytest test_sso_*.py -v --tb=short > test_results.log 2>&1

# 로그 확인
cat test_results.log

# 로그를 로컬로 복사
scp admin@your-nas-ip:/volume1/docker/video-download-to-nas/test_results.log .
```

### 주의사항

1. **리소스 사용**: 테스트 실행 시 CPU와 메모리를 사용하므로, 서비스 사용량이 적은 시간에 실행하는 것이 좋습니다.

2. **데이터베이스**: 테스트는 별도의 테스트 DB를 사용하므로 프로덕션 데이터에 영향을 주지 않습니다.

3. **컨테이너 재시작**: 테스트 중 문제가 발생하면 컨테이너를 재시작하세요:
   ```bash
   sudo docker-compose restart backend
   ```

4. **디스크 공간**: 테스트 DB 파일이 생성되므로 주기적으로 정리하세요:
   ```bash
   sudo docker exec video-download-to-nas-backend-1 rm -f /app/test_*.db
   ```

## CI/CD 통합

### GitHub Actions 예시

```yaml
name: SSO Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    
    - name: Run tests
      run: |
        cd backend
        python -m pytest test_sso_*.py -v --tb=short
```

## 테스트 모범 사례

1. **독립성:** 각 테스트는 독립적으로 실행 가능해야 함
2. **명확성:** 테스트 이름은 무엇을 테스트하는지 명확히 표현
3. **속도:** 단위 테스트는 빠르게 실행되어야 함
4. **신뢰성:** 테스트는 항상 같은 결과를 반환해야 함
5. **유지보수:** 코드 변경 시 테스트도 함께 업데이트

## 추가 리소스

- [pytest 공식 문서](https://docs.pytest.org/)
- [pytest-asyncio 문서](https://pytest-asyncio.readthedocs.io/)
- [FastAPI 테스팅 가이드](https://fastapi.tiangolo.com/tutorial/testing/)
- [unittest.mock 문서](https://docs.python.org/3/library/unittest.mock.html)

## 문의

테스트 관련 문제나 질문이 있으면 이슈를 생성하거나 개발팀에 문의하세요.
