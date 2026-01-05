# Video Download to NAS

[한국어](./README.ko.md) | **English**

![Project Status](https://img.shields.io/badge/status-personal%20use-blue)
![Maintenance](https://img.shields.io/badge/maintenance-as--needed-yellow)
![PRs](https://img.shields.io/badge/PRs-not%20accepted-red)
![License](https://img.shields.io/badge/license-MIT-green)

<img width="558" height="417" alt="스크린샷 2025-11-24 11 02 30" src="https://github.com/user-attachments/assets/93ec418e-d282-4ba4-95bd-670834a7a08e" />

<img width="1353" height="864" alt="스크린샷 2025-11-24 11 00 21" src="https://github.com/user-attachments/assets/fcf368e6-948c-4781-9716-e924616fe945" />


A modern, self-hosted media archiving tool with a beautiful dark theme UI. Compatible with the [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS-Extension).

> **Note**: This is a personal project maintained for personal use. Pull requests are not actively reviewed. Please fork if you want to add features.

## ⚠️ Legal Notice

**This software is a TOOL for personal media archiving and backup purposes.**

### User Responsibility
- **You** choose what content to download
- **You** are responsible for complying with copyright laws
- **You** must respect platform Terms of Service
- The developer is **not responsible** for how you use this tool

### Legitimate Use Cases
✅ Backing up your own uploaded content  
✅ Downloading Creative Commons licensed content  
✅ Archiving public domain materials  
✅ Educational Fair Use purposes  
✅ Personal backup of legally purchased content  

### Prohibited Uses
❌ Downloading copyrighted content without permission  
❌ Commercial redistribution of downloaded content  
❌ Violating platform Terms of Service  
❌ Mass downloading for commercial purposes  

**By using this software, you acknowledge that you understand and will comply with all applicable laws and terms of service.**

## ✨ Features

- 🎥 **Download videos** from 1000+ supported sites (powered by yt-dlp)
- 🎵 **Extract audio** in M4A or MP3 format
- 📝 **Download subtitles** in multiple languages (SRT, VTT)
- ✏️ **Rename files** with security validation and auto-extension preservation
- 📊 **Video metadata display** - view detailed information (resolution, codecs, bitrate, framerate)
- 🎨 **Beautiful UI** with modern dark theme
- 🔐 **Secure authentication** with JWT tokens and SSO support
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
   cd Video-Download-to-NAS
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

   **First User Setup:**
   - The first user to register will automatically become the super admin
   - Choose a strong username and password
   - This account will have full system access

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

## 🔧 Configuration

### Environment Variables

Edit `.env` file:

```env
# Security (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-change-me
SSO_ENCRYPTION_KEY=your-sso-encryption-key-if-using-sso
ALLOWED_ORIGINS=*
```

### Download Location

By default, downloads are saved to `./downloads`. You can change this in `docker-compose.yml`:

```yaml
volumes:
  - /path/to/your/nas/folder:/app/downloads
```

## 🔌 Browser Extension Setup

This server is compatible with the [Video Download to NAS Extension](https://github.com/sruinz/Video-Download-to-NAS-Extension).

### Method 1: Config URL (Easiest - Recommended)

1. Install the extension from Chrome/Edge store
2. Log in to the web UI
3. Go to **Account Settings** > **API Tokens** tab
4. Click **"Generate New Token"**
5. Copy the **"Method 1: Config URL"**
6. Open extension options and paste the Config URL
7. Save

### Method 2: Username + API Token

1. Generate an API token (steps 2-4 above)
2. Copy the **"Method 2: API Token"**
3. Open extension options and configure:
   - **Authentication Method**: Username + API Token
   - **REST API URL**: `http://your-nas-ip:8000/rest`
   - **Username**: Your username
   - **API Token**: Paste the token

### Method 3: Username + Password (Legacy)

1. Open extension options
2. Configure:
   - **Authentication Method**: Username + Password
   - **REST API URL**: `http://your-nas-ip:8000/rest`
   - **Username**: Your username
   - **Password**: Your password

**Note:** Methods 1 and 2 are more secure and recommended, especially for SSO users.

## 🔑 API Token Authentication

API tokens provide a secure way to authenticate external applications (browser extensions, Telegram bots) without using your password.

### Benefits

- ✅ **More secure** than password authentication
- ✅ **Works with SSO** accounts (Google, Microsoft, GitHub, etc.)
- ✅ **Individual management** - create multiple tokens for different apps
- ✅ **Easy revocation** - revoke tokens without changing password
- ✅ **Audit trail** - see when each token was last used

### Creating API Tokens

1. Log in to the web UI
2. Click your profile icon > **Account Settings**
3. Go to **API Tokens** tab
4. Click **"Generate New Token"**
5. Enter a descriptive name (e.g., "My Telegram Bot", "Chrome Extension")
6. Copy the token immediately (it won't be shown again!)

### Using API Tokens

**Config URL (Simplest)**
```
http://your-nas-ip:3000#vdtn_abc123def456...
```
Just paste this URL into your extension or bot configuration.

**API Token (Advanced)**
```
Authorization: Bearer vdtn_abc123def456...
```
Use this header in API requests.

**Username + Password (Legacy)**
```json
{
  "id": "username",
  "pw": "password"
}
```
Include in request body (not recommended for security).

### Security Best Practices

- 🔒 **Use API tokens** instead of passwords when possible
- 🔄 **Rotate tokens** regularly (every 3-6 months)
- 🗑️ **Revoke unused tokens** immediately
- 📝 **Use descriptive names** to track token usage
- 🚫 **Never share tokens** publicly or in code repositories
- ⚠️ **Treat tokens like passwords** - keep them secret!

### Token Limits

- Maximum **10 active tokens** per user
- Tokens never expire (until revoked)
- Last used timestamp tracked for each token

## 📖 API Documentation

### Authentication

**Login**
```http
POST /api/login
Content-Type: application/json

{
  "id": "your_username",
  "pw": "your_password"
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
  "url": "https://example.com/video/...",
  "resolution": "1080p",
  "id": "your_username",
  "pw": "your_password"
}
```

**Start Download (With Token)**
```http
POST /api/download
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/video/...",
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

**Note**: This is a personal project maintained for personal use. Pull requests are not actively reviewed or merged.

If you want to add features or fix bugs:
- **Fork the repository** and make your changes
- **Maintain your own fork** with your improvements
- **Share your fork** if others might benefit

Bug reports via GitHub Issues are welcome and help document known issues.

## 📄 License

MIT License

## 🙏 Credits

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video download engine
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework

## ⚠️ Important Legal Information

### This is a Tool, Not a Service

This software is a **general-purpose media downloading tool** based on yt-dlp. It does not host, provide, or distribute any content. Users provide their own URLs and make their own choices about what to download.

### Your Responsibilities

1. **Copyright Compliance**: Ensure you have the right to download and store the content
2. **Terms of Service**: Respect the terms of service of websites you access
3. **Personal Use**: This tool is designed for personal, non-commercial use
4. **Legal Compliance**: Follow all applicable laws in your jurisdiction

### Developer Liability

The developers of this software:
- Do NOT endorse or encourage copyright infringement
- Do NOT control what users choose to download
- Are NOT responsible for user actions or violations
- Provide this tool "AS IS" without warranties

### Acknowledgment

By installing and using this software, you acknowledge that:
- You understand these terms and your responsibilities
- You will use this tool only for legitimate, legal purposes
- You accept full responsibility for your actions
- The developers are not liable for any misuse

### Questions or Concerns?

If you believe this tool is being misused or have legal concerns, please contact the repository maintainer.

---

**Remember**: Just because you *can* download something doesn't mean you *should*. Always respect creators' rights and platform policies.



---

## ☕ Support

If this project helped you, buy me a coffee!

<a href="https://www.buymeacoffee.com/sruinz" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
