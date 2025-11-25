# Video Download to NAS

**한국어** | [English](./README.md)

![프로젝트 상태](https://img.shields.io/badge/status-personal%20use-blue)
![유지보수](https://img.shields.io/badge/maintenance-as--needed-yellow)
![PR](https://img.shields.io/badge/PRs-not%20accepted-red)
![라이선스](https://img.shields.io/badge/license-MIT-green)

<img width="558" height="417" alt="스크린샷 2025-11-24 11 02 30" src="https://github.com/user-attachments/assets/93ec418e-d282-4ba4-95bd-670834a7a08e" />

<img width="1353" height="864" alt="스크린샷 2025-11-24 11 00 21" src="https://github.com/user-attachments/assets/fcf368e6-948c-4781-9716-e924616fe945" />


셀프 호스팅 미디어 아카이빙 도구. 아름다운 다크 테마 UI 제공. [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS-Extension)과 호환됩니다.

> **참고**: 이것은 개인 사용을 위해 유지 관리되는 개인 프로젝트입니다. 풀 리퀘스트는 적극적으로 검토되지 않습니다. 기능을 추가하려면 포크하세요.

## ⚠️ 법적 고지

**이 소프트웨어는 개인 미디어 아카이빙 및 백업 목적의 도구입니다.**

### 사용자 책임
- **귀하**가 다운로드할 콘텐츠를 선택합니다
- **귀하**가 저작권법 준수에 책임이 있습니다
- **귀하**가 플랫폼 이용약관을 존중해야 합니다
- 개발자는 귀하의 도구 사용에 대해 **책임지지 않습니다**

### 합법적 사용 사례
✅ 본인이 업로드한 콘텐츠 백업  
✅ 크리에이티브 커먼즈 라이선스 콘텐츠 다운로드  
✅ 퍼블릭 도메인 자료 아카이빙  
✅ 교육적 공정 이용 목적  
✅ 합법적으로 구매한 콘텐츠의 개인 백업  

### 금지된 사용
❌ 허가 없이 저작권 콘텐츠 다운로드  
❌ 다운로드한 콘텐츠의 상업적 재배포  
❌ 플랫폼 이용약관 위반  
❌ 상업적 목적의 대량 다운로드  

**이 소프트웨어를 사용함으로써, 귀하는 모든 관련 법률 및 이용약관을 이해하고 준수할 것임을 인정합니다.**

## ✨ 주요 기능

- 🎥 **비디오 다운로드** - 1000개 이상의 사이트 지원 (yt-dlp 기반)
- 🎵 **오디오 추출** - M4A 또는 MP3 형식
- 📝 **자막 다운로드** - 다국어 지원 (SRT, VTT)
- 🎨 **아름다운 UI** - 모던 다크 테마
- 🔐 **보안 인증** - JWT 토큰 및 SSO 지원
- 📱 **반응형 디자인** - 모든 기기에서 작동
- 🔌 **확장 프로그램 호환** - 브라우저 확장과 연동
- 🐳 **Docker 지원** - Docker Compose로 간편한 배포

## 🚀 빠른 시작

### 사전 요구사항

- Docker & Docker Compose
- NAS 네트워크 접근

### 설치

1. **프로젝트 디렉토리 생성**
   ```bash
   cd Video-Download-to-NAS
   ```

2. **환경 변수 설정**
   ```bash
   cp .env.example .env
   # .env 파일을 편집하여 설정을 변경하세요!
   ```

3. **서비스 시작**
   ```bash
   docker-compose up -d
   ```

4. **웹 인터페이스 접속**
   ```
   http://your-nas-ip:3000
   ```

   **첫 사용자 설정:**
   - 첫 번째로 가입하는 사용자가 자동으로 슈퍼 관리자가 됩니다
   - 강력한 사용자명과 비밀번호를 선택하세요
   - 이 계정은 전체 시스템 접근 권한을 갖습니다

## 📦 시놀로지 NAS 배포

1. DSM에서 **Docker** 앱 열기
2. **레지스트리**에서 `python`과 `node` 검색 및 다운로드
3. **File Station**에서 폴더 생성: `/docker/video-download-to-nas`
4. 프로젝트 파일을 이 폴더에 업로드
5. **터미널** (SSH)을 열고 실행:
   ```bash
   cd /volume1/docker/video-download-to-nas
   sudo docker-compose up -d
   ```

## 🔧 설정

### 환경 변수

`.env` 파일 편집:

```env
# 보안 (반드시 변경하세요!)
JWT_SECRET=your-super-secret-jwt-key-change-me
SSO_ENCRYPTION_KEY=your-sso-encryption-key-if-using-sso
ALLOWED_ORIGINS=*
```

### 다운로드 위치

기본적으로 다운로드는 `./downloads`에 저장됩니다. `docker-compose.yml`에서 변경 가능:

```yaml
volumes:
  - /path/to/your/nas/folder:/app/downloads
```

## 🔌 브라우저 확장 프로그램 설정

이 서버는 [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS-Extension)과 호환됩니다.

### 방법 1: Config URL (가장 쉬움 - 권장)

1. Chrome/Edge 스토어에서 확장 프로그램 설치
2. 웹 UI에 로그인
3. **계정 설정** > **API 토큰** 탭으로 이동
4. **"새 토큰 생성"** 클릭
5. **"방법 1: Config URL"** 복사
6. 확장 프로그램 옵션을 열고 Config URL 붙여넣기
7. 저장

### 방법 2: 사용자명 + API 토큰

1. API 토큰 생성 (위 2-4단계)
2. **"방법 2: API 토큰"** 복사
3. 확장 프로그램 옵션 설정:
   - **인증 방법**: 사용자명 + API 토큰
   - **REST API URL**: `http://your-nas-ip:8000/rest`
   - **사용자명**: 귀하의 사용자명
   - **API 토큰**: 토큰 붙여넣기

### 방법 3: 사용자명 + 비밀번호 (레거시)

1. 확장 프로그램 옵션 열기
2. 설정:
   - **인증 방법**: 사용자명 + 비밀번호
   - **REST API URL**: `http://your-nas-ip:8000/rest`
   - **사용자명**: 귀하의 사용자명
   - **비밀번호**: 귀하의 비밀번호

**참고:** 방법 1과 2가 더 안전하며, 특히 SSO 사용자에게 권장됩니다.

## 🔑 API 토큰 인증

API 토큰은 비밀번호 없이 외부 애플리케이션(브라우저 확장, 텔레그램 봇)을 인증하는 안전한 방법입니다.

### 장점

- ✅ 비밀번호 인증보다 **더 안전**
- ✅ SSO 계정과 **호환** (Google, Microsoft, GitHub 등)
- ✅ **개별 관리** - 다양한 앱에 대해 여러 토큰 생성
- ✅ **쉬운 취소** - 비밀번호 변경 없이 토큰 취소
- ✅ **감사 추적** - 각 토큰의 마지막 사용 시간 확인

### API 토큰 생성

1. 웹 UI에 로그인
2. 프로필 아이콘 클릭 > **계정 설정**
3. **API 토큰** 탭으로 이동
4. **"새 토큰 생성"** 클릭
5. 설명적인 이름 입력 (예: "내 텔레그램 봇", "Chrome 확장")
6. 토큰을 즉시 복사 (다시 표시되지 않습니다!)

### 보안 모범 사례

- 🔒 가능한 경우 비밀번호 대신 **API 토큰 사용**
- 🔄 정기적으로 **토큰 교체** (3-6개월마다)
- 🗑️ 사용하지 않는 토큰 **즉시 취소**
- 📝 토큰 사용 추적을 위해 **설명적인 이름 사용**
- 🚫 공개적으로 또는 코드 저장소에 **토큰 공유 금지**
- ⚠️ 토큰을 비밀번호처럼 **비밀로 유지**!

## 📖 API 문서

### 인증

**로그인**
```http
POST /api/login
Content-Type: application/json

{
  "id": "your_username",
  "pw": "your_password"
}
```

응답:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

### 비디오 다운로드

**다운로드 시작 (확장 프로그램 호환)**
```http
POST /rest
Content-Type: application/json

{
  "url": "https://example.com/video/...",
  "resolution": "1080p",
  "id": "your_username",
  "pw": "your_password"
}
```

**다운로드 시작 (토큰 사용)**
```http
POST /api/download
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/video/...",
  "resolution": "best"
}
```

### 지원 해상도

- 비디오: `best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `144p`
- 오디오: `audio-m4a`, `audio-mp3`
- 자막: `srt|ko`, `srt|en`, `srt|ja`, `vtt|ko`, `vtt|en`, `vtt|ja`

## 🛠️ 개발

### 로컬 실행

**백엔드:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**프론트엔드:**
```bash
cd frontend
npm install
npm run dev
```

## 📝 기술 스택

- **백엔드**: FastAPI, yt-dlp, SQLAlchemy, JWT
- **프론트엔드**: React, Vite, TailwindCSS, Lucide Icons
- **데이터베이스**: SQLite
- **컨테이너**: Docker, Nginx

## 🤝 기여

**참고**: 이것은 개인 사용을 위해 유지 관리되는 개인 프로젝트입니다. 풀 리퀘스트는 적극적으로 검토되거나 병합되지 않습니다.

기능을 추가하거나 버그를 수정하려면:
- **저장소를 포크**하여 변경하세요
- **자신의 포크를 유지 관리**하세요
- 다른 사람에게 도움이 될 수 있다면 **포크를 공유**하세요

GitHub Issues를 통한 버그 보고는 환영하며 알려진 문제를 문서화하는 데 도움이 됩니다.

## 📄 라이선스

MIT License

## 🙏 크레딧

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 비디오 다운로드 엔진
- [FastAPI](https://fastapi.tiangolo.com/) - 모던 Python 웹 프레임워크

## ⚠️ 중요한 법적 정보

### 이것은 도구이지 서비스가 아닙니다

이 소프트웨어는 yt-dlp 기반의 **범용 미디어 다운로드 도구**입니다. 콘텐츠를 호스팅, 제공 또는 배포하지 않습니다. 사용자가 자신의 URL을 제공하고 다운로드할 내용을 선택합니다.

### 귀하의 책임

1. **저작권 준수**: 콘텐츠를 다운로드하고 저장할 권리가 있는지 확인
2. **이용약관**: 접근하는 웹사이트의 이용약관 존중
3. **개인 사용**: 이 도구는 개인적, 비상업적 사용을 위해 설계됨
4. **법률 준수**: 귀하의 관할권의 모든 관련 법률 준수

### 개발자 책임

이 소프트웨어의 개발자는:
- 저작권 침해를 지지하거나 장려하지 **않습니다**
- 사용자가 다운로드하기로 선택한 것을 통제하지 **않습니다**
- 사용자 행동이나 위반에 대해 책임지지 **않습니다**
- 이 도구를 보증 없이 "있는 그대로" 제공합니다

### 인정

이 소프트웨어를 설치하고 사용함으로써, 귀하는 다음을 인정합니다:
- 이러한 조건과 귀하의 책임을 이해합니다
- 합법적이고 정당한 목적으로만 이 도구를 사용할 것입니다
- 귀하의 행동에 대한 전적인 책임을 수락합니다
- 개발자는 오용에 대해 책임지지 않습니다

### 질문이나 우려사항?

이 도구가 오용되고 있다고 생각하거나 법적 우려사항이 있는 경우, 저장소 관리자에게 문의하세요.

---

**기억하세요**: 무언가를 다운로드할 *수* 있다고 해서 다운로드해야 *한다*는 의미는 아닙니다. 항상 크리에이터의 권리와 플랫폼 정책을 존중하세요.


---

## ☕ 후원

이 프로젝트가 도움이 되셨다면 커피 한 잔 사주세요!

<a href="https://www.buymeacoffee.com/sruinz" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
