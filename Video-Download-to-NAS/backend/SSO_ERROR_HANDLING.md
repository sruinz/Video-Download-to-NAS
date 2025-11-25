# SSO 오류 처리 구현 문서

## 개요

이 문서는 SSO 인증 시스템의 오류 처리 및 사용자 피드백 구현을 설명합니다.

## 백엔드 오류 처리

### 커스텀 예외 클래스 (`app/sso/exceptions.py`)

모든 SSO 관련 오류를 처리하기 위한 커스텀 예외 클래스를 구현했습니다:

#### 1. `SSOException` (기본 클래스)
- 모든 SSO 예외의 기본 클래스
- HTTPException을 상속

#### 2. `SSOAuthenticationError`
- OAuth2 인증 실패 시 발생
- 401 Unauthorized 상태 코드

#### 3. `SSOStateError`
- State 파라미터 불일치 또는 만료 시 발생
- CSRF 공격 방지
- 400 Bad Request 상태 코드

#### 4. `SSOEmailMismatchError`
- 계정 연동 시 이메일 불일치
- 400 Bad Request 상태 코드

#### 5. `SSOProviderNotConfiguredError`
- Provider가 설정되지 않았거나 비활성화됨
- 503 Service Unavailable 상태 코드

#### 6. `SSORegistrationDisabledError`
- 등록이 비활성화된 상태에서 신규 사용자 시도
- 403 Forbidden 상태 코드

#### 7. `SSOProviderNotFoundError`
- Provider를 찾을 수 없음
- 404 Not Found 상태 코드

#### 8. `SSOAlreadyLinkedError`
- 이미 연동된 Provider에 재연동 시도
- 400 Bad Request 상태 코드

#### 9. `SSONotLinkedError`
- 연동되지 않은 Provider 연동 해제 시도
- 400 Bad Request 상태 코드

#### 10. `SSOUserInfoError`
- Provider로부터 필수 사용자 정보를 받지 못함
- 400 Bad Request 상태 코드

#### 11. `SSOTokenExchangeError`
- 인증 코드를 토큰으로 교환 실패
- 400 Bad Request 상태 코드

#### 12. `SSONetworkError`
- Provider와의 네트워크 연결 오류
- 503 Service Unavailable 상태 코드

### 라우터 오류 처리 개선

#### `/api/sso/{provider}/login` 엔드포인트
- Provider 존재 여부 확인
- Provider 활성화 상태 확인
- 예외 발생 시 적절한 커스텀 예외 사용

#### `/api/sso/{provider}/callback` 엔드포인트
- OAuth2 에러 파라미터 처리
- 사용자 친화적 에러 메시지 매핑:
  - `access_denied` → "You denied access..."
  - `invalid_request` → "Invalid authentication request..."
  - `server_error` → "Provider is experiencing issues..."
- State 검증 실패 처리
- 토큰 교환 실패 처리
- 사용자 정보 조회 실패 처리
- 필수 필드 누락 검증
- 계정 연동 시 이메일 불일치 처리
- 등록 비활성화 처리

#### `/api/sso/{provider}/link` 엔드포인트
- 이미 연동된 Provider 확인
- Provider 존재 및 활성화 확인

#### `/api/sso/{provider}/unlink` 엔드포인트
- 연동되지 않은 Provider 확인

## 프론트엔드 오류 처리

### 번역 추가

#### 영어 (`en.json`)
```json
"sso": {
  "errors": {
    "invalidState": "Invalid or expired authentication state...",
    "emailMismatch": "Email mismatch...",
    "providerNotConfigured": "SSO provider is not configured...",
    "registrationDisabled": "Registration is disabled...",
    "providerNotFound": "SSO provider not found.",
    "alreadyLinked": "Your account is already linked...",
    "notLinked": "Your account is not linked...",
    "missingUserInfo": "Provider did not return required user information.",
    "tokenExchangeFailed": "Failed to exchange authorization code...",
    "networkError": "Network error while connecting...",
    "accessDenied": "You denied access to your account...",
    "invalidRequest": "Invalid authentication request...",
    "serverError": "Provider is experiencing issues...",
    "unexpectedError": "An unexpected error occurred...",
    "retryPrompt": "Would you like to try again?"
  }
}
```

#### 한국어 (`ko.json`)
- 모든 오류 메시지의 한국어 번역 추가

### SSOCallback 컴포넌트 개선

#### 기능 추가:
1. **오류 타입 감지**
   - URL 파라미터에서 오류 메시지 분석
   - 오류 유형 자동 분류:
     - `access_denied`: 사용자가 접근 거부
     - `state_error`: State 파라미터 오류
     - `email_mismatch`: 이메일 불일치
     - `registration_disabled`: 등록 비활성화
     - `network_error`: 네트워크 오류
     - `provider_not_configured`: Provider 미설정
     - `general`: 일반 오류

2. **사용자 친화적 UI**
   - 오류 아이콘 표시 (AlertCircle)
   - 오류 메시지 박스
   - 오류 유형별 가이드 메시지
   - 재시도 버튼 (RefreshCw 아이콘)
   - 성공 시 체크마크 아이콘

3. **재시도 옵션**
   - "다시 시도하시겠습니까?" 버튼
   - 로그인 페이지로 리다이렉트
   - 로딩 상태 표시

4. **관리자 문의 안내**
   - 등록 비활성화 또는 Provider 미설정 시
   - "관리자에게 문의하세요" 메시지 표시

### Login 컴포넌트 개선

#### 기능 추가:
1. **URL 파라미터에서 오류 감지**
   - SSO 콜백에서 리다이렉트된 오류 표시
   - Toast 알림으로 오류 표시
   - URL 정리 (history.replaceState)

2. **오류 상태 관리**
   - 로컬 상태에 오류 저장
   - 오류 박스에 표시

## 오류 처리 플로우

### 1. 로그인 시작 오류
```
사용자 → SSO 로그인 버튼 클릭
     → Provider 미설정/비활성화
     → SSOProviderNotConfiguredError 발생
     → 사용자에게 오류 메시지 표시
```

### 2. 콜백 처리 오류
```
Provider → 인증 코드 반환
        → State 검증 실패
        → SSOStateError 발생
        → 로그인 페이지로 리다이렉트 (오류 포함)
        → SSOCallback 컴포넌트에서 오류 표시
        → 재시도 옵션 제공
```

### 3. 계정 연동 오류
```
사용자 → 계정 연동 시도
     → 이메일 불일치
     → ValueError 발생
     → 설정 페이지로 리다이렉트 (오류 포함)
     → 오류 메시지 표시
```

## 테스트 시나리오

### 백엔드 테스트
1. ✅ Provider 미설정 시 오류 처리
2. ✅ State 불일치 시 오류 처리
3. ✅ 이메일 불일치 시 오류 처리
4. ✅ 등록 비활성화 시 오류 처리
5. ✅ 네트워크 오류 시 오류 처리
6. ✅ 토큰 교환 실패 시 오류 처리
7. ✅ 사용자 정보 누락 시 오류 처리

### 프론트엔드 테스트
1. ✅ 오류 메시지 표시
2. ✅ 오류 유형별 가이드 표시
3. ✅ 재시도 버튼 동작
4. ✅ Toast 알림 표시
5. ✅ 다국어 지원 (한국어/영어)

## 보안 고려사항

1. **민감한 정보 노출 방지**
   - 내부 오류 메시지를 사용자 친화적 메시지로 변환
   - 로그에만 상세 오류 기록

2. **CSRF 공격 방지**
   - State 파라미터 검증
   - 만료된 State 자동 정리

3. **Rate Limiting**
   - SSO 엔드포인트에 Rate Limiting 적용 (기존 구현)

## 요구사항 충족

### 요구사항 9.1: OAuth2 인증 실패 처리
✅ SSOAuthenticationError 및 관련 예외 클래스 구현

### 요구사항 9.2: State 불일치 오류
✅ SSOStateError 구현 및 검증 로직

### 요구사항 9.3: 이메일 불일치 오류
✅ SSOEmailMismatchError 구현

### 요구사항 9.4: Provider 설정 누락 오류
✅ SSOProviderNotConfiguredError 구현

### 요구사항 9.5: 사용자 피드백
✅ Toast 알림, 오류 박스, 재시도 옵션 구현

## 향후 개선 사항

1. **오류 로깅 강화**
   - Sentry 또는 유사 서비스 통합
   - 오류 발생 빈도 모니터링

2. **사용자 경험 개선**
   - 오류별 맞춤형 해결 방법 제시
   - FAQ 링크 추가

3. **관리자 알림**
   - 반복적인 오류 발생 시 관리자에게 알림
   - 오류 통계 대시보드

4. **자동 복구**
   - 일시적 네트워크 오류 시 자동 재시도
   - Exponential backoff 구현
