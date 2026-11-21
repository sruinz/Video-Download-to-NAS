# Video Download to NAS

## What's New in 1.1.12

- Fixed fullscreen 4-sided letterboxing on lower-resolution or non-16:9 videos by scaling `<video>` with `w-full h-full object-contain`.
- Added web player subtitle playback with on-the-fly SRT→WebVTT streaming, CC track picker, `C` shortcut toggle, and customizable caption styling (font size, font family, text color, background opacity, and vertical position).
- Added dedicated **Subtitles** tab in Account Settings for server-wide automatic subtitle co-downloading across Web UI, browser extension, and Telegram bot, plus browser player caption preferences.
- Hid standalone subtitle items from `All Types`, displayed dedicated subtitle cards (`SRT · KO`, real disk file size) in the `Subtitle` tab, and added `CC` badges to videos with matching subtitles.

## What's New in 1.1.11

- Added **Grid, List (with sortable column headers), and Folder views** (actual NAS folders plus grouping by Month, Site, or Uploader) to both My Library and Public Board with full file action parity across all views.
- Added selectable **Infinite Scroll** and **Pagination** (`12 / 24 / 48 / 96` items per page) browse modes with preferences saved automatically.
- Added **Repeat (Repeat All / Repeat One)** and **Shuffle** playback modes to the media player, plus playlist continuity on Public Board.
- Added **Buy Me a Coffee** support links to the footer and Account Settings modal.

## What's New in 1.1.10

- Fixed an issue where downloads requested via browser extension or API resulted in distorted filenames when URLs or video IDs were passed as the filename parameter.
- Strengthened backend output filename validation to preserve yt-dlp extracted video titles.

## What's New in 1.1.9

- Fixed library loading for records created from sources that report fractional media durations.
- Existing fractional duration values are repaired automatically at backend startup. Re-downloading or syncing the library is unnecessary.

## What's New in 1.1.8-2

- When local login is disabled, super administrator recovery login is available only through a direct internal IP address over HTTP.
- Reverse-proxy access hides the administrator login button and blocks password authentication through the login and REST APIs. SSO and API token authentication remain available.
- Details: [Administrator recovery login guide](LOCAL_LOGIN_RECOVERY.md)

## 1.1.8-1 변경사항

- 비회원 접근과 다운로드를 허용한 공유 링크에서 한글·Unicode·공백·특수문자가 포함된 파일명이 RFC 호환 `Content-Disposition`으로 정상 다운로드되도록 수정

## 1.1.8 변경사항

- `/rest`와 `/api/download`에 역할별 다운로드 요청 제한을 실제 적용
- 사용자별 요청 제한이 설정된 경우 역할 기본값보다 우선 적용
- 브라우저 확장이 요청 제한 HTTP 429 응답의 대기 시간을 처리하고 재시도할 수 있도록 응답 헤더 제공
- 원본 서버가 HTTP 429를 반환하면 30초 또는 60초 지연 후 서버가 자동으로 재시도
- 서버가 다운로드 요청을 순차적으로 실행하도록 변경
- 요청별 작업 파일을 격리하고 한 요청에서 생성된 다중 결과 파일을 모두 보존

A modern, self-hosted video download service with a beautiful YouTube-inspired UI. Compatible with the [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS).

## ✨ Features

- 🎥 **Download videos** from YouTube and 1000+ sites (powered by yt-dlp)
- 🎵 **Extract audio** in M4A or MP3 format
- 📝 **Download subtitles** in multiple languages (SRT, VTT)
- 🎨 **Beautiful UI** with YouTube-inspired dark theme
- 🔐 **Secure authentication** with JWT tokens and rate limiting
- 🔍 **Search & filter** library with pagination
- 🔗 **File sharing** with expiration and password protection
- 📱 **Responsive design** works on all devices
- 🔌 **Extension compatible** - works with browser extensions
- 🐳 **Docker ready** - easy deployment with Docker Compose

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Network access to your NAS

### Installation

1. **Clone or create the project directory**
   ```bash
   cd video-download-to-nas-server
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and change the default credentials!
   ```

3. **Start the services**
   ```bash
   docker-compose up -d
   ```

4. **Access the web interface**
   ```
   http://your-nas-ip:3000
   ```

   Default credentials:
   - Username: `admin`
   - Password: `admin123`

## 📦 Synology NAS Deployment

1. Open **Docker** app in DSM
2. Go to **Registry** and search for `python` and `node`
3. Go to **Image** and download both images
4. Open **File Station** and create a folder: `/docker/video-download-to-nas`
5. Upload the project files to this folder
6. Open **Terminal** (SSH) and run:
   ```bash
   cd /volume1/docker/video-download-to-nas
   sudo docker-compose up -d
   ```

### NPM Plus / Reverse Proxy Setup

**Good news!** Version v1.1.0+ includes built-in Nginx proxy configuration. No additional setup needed for most users!

For advanced configurations or troubleshooting, see:
- [NPM Plus Setup Guide (English)](./NPM_PLUS_SETUP_GUIDE.md)
- [NPM Plus 설정 가이드 (한국어)](./NPM_PLUS_설정가이드.md)

#### Secure Deployment (Recommended)

Use `docker-compose.secure.yml` to prevent backend from being exposed externally:

```bash
docker-compose -f docker-compose.secure.yml up -d
```

This configuration:
- ✅ Only exposes port 3000 (frontend)
- ✅ Backend accessible only through frontend proxy
- ✅ Better security for production environments

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

```env
# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-me-in-production
DEFAULT_USER=admin
DEFAULT_PASSWORD=admin123

# Database
DATABASE_URL=sqlite:///app/data/vdtn.db

# CORS Settings (comma-separated list of allowed origins)
# Example: http://localhost:3000,http://192.168.1.100:3000
# Use * for development only
ALLOWED_ORIGINS=*

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

### Download Location

By default, downloads are saved to `./downloads`. You can change this in `docker-compose.yml`:

```yaml
volumes:
  - /path/to/your/nas/folder:/app/downloads
```

## 🔌 Browser Extension Setup

This server is compatible with the [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS).

1. Install the extension from Chrome/Edge store
2. Open extension options
3. Configure:
   - **REST API URL**: `http://your-nas-ip:3000/rest`
   - **Username**: Your username
   - **Password**: Your password

## 📖 API Documentation

### Authentication

**Login**
```http
POST /api/login
Content-Type: application/json

{
  "id": "admin",
  "pw": "admin123"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

### Download Video

**Start Download (Extension Compatible)**
```http
POST /rest
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=...",
  "resolution": "1080p",
  "id": "admin",
  "pw": "admin123"
}
```

**Start Download (With Token)**
```http
POST /api/download
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=...",
  "resolution": "best"
}
```

### Supported Resolutions

- Video: `best`, `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `144p`
- Audio: `audio-m4a`, `audio-mp3`
- Subtitles: `srt|ko`, `srt|en`, `srt|ja`, `vtt|ko`, `vtt|en`, `vtt|ja`

## 🛠️ Development

### Run Locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📝 Technology Stack

- **Backend**: FastAPI, yt-dlp, SQLAlchemy, JWT
- **Frontend**: React, Vite, TailwindCSS, Lucide Icons
- **Database**: SQLite
- **Container**: Docker, Nginx

## 🤝 Contributing

Issues and pull requests are welcome!

## 📄 License

MIT License

## 🙏 Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video download engine
- [youtube-dl-nas](https://github.com/hyeonsangjeon/youtube-dl-nas) - Original inspiration
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework

## ⚠️ Disclaimer

This tool is for personal use only. Respect copyright laws and terms of service of the websites you download from.
