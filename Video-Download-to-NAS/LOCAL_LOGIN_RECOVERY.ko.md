# 관리자 백업 로그인 접근 제한 (1.1.8-2)

**한국어** | [English](LOCAL_LOGIN_RECOVERY.md)

로컬 로그인을 끈 경우, NASCertPilot의 내부 HTTP 접속 복구 방식을 적용합니다. 서버가 접속 조건을 판단하고 로그인 화면과 비밀번호 인증 API가 같은 정책을 사용합니다.

| 접속 방식 | 관리자 백업 로그인 |
| --- | --- |
| `http://192.168.0.11:3000` 같은 내부 IP 직접 접속 | 최고 관리자만 허용 |
| 내부 IPv6·루프백·링크 로컬 IP로 직접 HTTP 접속 | 최고 관리자만 허용 |
| 역방향 프록시 경유, 외부 도메인, 공인 IP | 숨김 및 HTTP 403 차단 |
| HTTPS 또는 `nas.local` 같은 호스트 이름 | 숨김 및 HTTP 403 차단 |
| 로컬 로그인 설정을 켠 경우 | 기존 비밀번호 로그인 유지 |

내부 IPv4 범위는 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`이며, IPv6는 `::1`, `fc00::/7`, `fe80::/10`입니다. 서버에 연결한 상대 주소도 내부 IP여야 합니다. 도메인의 DNS 결과로 내부 여부를 판단하지 않습니다.

## 적용 범위

- `/api/settings/public`이 요청별 `admin_local_login_allowed`를 반환하며 응답을 캐시하지 않습니다.
- 로그인 화면은 서버 설정을 확인한 뒤에만 비밀번호 폼이나 관리자 버튼을 표시합니다. 설정 조회 실패 시 표시하지 않습니다.
- 내부 접속에서는 SSO 공급자 조회에 실패해도 관리자 복구 버튼을 유지합니다.
- `/api/login`과 `/rest`의 계정·비밀번호 인증에 같은 제한을 적용합니다. 외부 요청은 비밀번호 검사 전에 거부합니다.
- `/rest`의 API 토큰 인증과 SSO 인증은 유지합니다.

## 역방향 프록시 설정

백엔드와 프런트엔드를 함께 업데이트해야 합니다. 내장 Nginx는 외부 프록시의 `Forwarded`, `X-Forwarded-*`, `X-Real-IP` 표시를 보존해 판정에 사용하고, 자체 전달 요청과 구분합니다.

외부 프록시에서는 원래 Host를 전달하고 `X-Forwarded-Proto`를 설정하십시오. 예를 들어 Nginx 프록시의 해당 location에서 다음을 사용합니다.

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

외부 프록시가 Host를 내부 IP로 바꾸면서 모든 전달 헤더까지 제거하면 애플리케이션은 내부 직접 요청과 구별할 수 없습니다. 이 제한은 방화벽을 대신하지 않으며, 백엔드 포트를 외부에 직접 공개하지 않는 구성이 필요합니다.

## 검증

새 회귀 테스트는 별도 메모리 DB를 사용합니다. 서버 디렉터리에서 다음을 실행합니다.

```bash
cd backend
python -m pytest test_local_login_access.py test_server_release.py -q
cd ../frontend
npm run build
```

SSO의 기존 `test_sso_auth_logic.py`는 권한 저장값 대신 역할 상속을 반영한 실제 권한을 검사하도록 보완했습니다.
