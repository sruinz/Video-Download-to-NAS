# Video Download to NAS (VDTN)

Self-hosted media archiving solution for legitimate backup and archival purposes.

## ⚠️ Legal Notice

**This is a tool for legitimate media archiving and backup purposes.**

### User Responsibility
- Users are solely responsible for copyright compliance
- Users must respect platform Terms of Service  
- Users choose what content to download
- Developer assumes no liability for user actions

### Legitimate Uses
✅ Personal backup of your own content  
✅ Creative Commons licensed content  
✅ Educational Fair Use purposes  
✅ Public domain material archival  

### Prohibited Uses
❌ Downloading copyrighted content without permission  
❌ Commercial redistribution  
❌ Violating platform Terms of Service  

## 🚀 Quick Start

```bash
# Clone and start
git clone https://github.com/sruinz/Video-Download-to-NAS.git
cd Video-Download-to-NAS
cp .env.example .env
# Edit .env with your settings
docker-compose up -d
```

Access at http://localhost:3000

## 📋 Features

- 1000+ video sites support via yt-dlp
- Self-hosted web interface
- NAS integration
- Download management
- Format selection
- Progress tracking
- Mobile responsive
- SSO authentication support
- API token authentication
- Telegram bot integration

## 🔧 Configuration

### Required Settings

Edit `.env` file (copy from `.env.example`):

```env
# Required - Change in production!
JWT_SECRET=your-unique-secret-key-32-64-chars

# Required - CORS origins
ALLOWED_ORIGINS=*

# Required - URLs for your environment
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
SERVER_URL=http://localhost:3000

# Optional - Only if using SSO
SSO_ENCRYPTION_KEY=

# Optional - Telegram Bot (for notifications)
TELEGRAM_BOT_ENABLED=false
TELEGRAM_BOT_AUTO_START=false
```

### Volume Configuration

Configure paths in `docker-compose.yml`:

```yaml
volumes:
  - ./downloads:/app/downloads  # Downloaded files
  - ./data:/app/data            # Database
```

### Initial Setup

1. Start containers: `docker-compose up -d`
2. Access http://localhost:3000
3. **Register first account - becomes super_admin automatically**
4. Configure additional settings in web UI

### Optional Features

**Telegram Bot**: Enable in web UI after setup
- Set `TELEGRAM_BOT_ENABLED=true` in `.env`
- Configure bot token and settings in web interface

**SSO Authentication**: For enterprise environments
- Generate `SSO_ENCRYPTION_KEY` if needed
- Configure providers in web UI

For detailed configuration, see `.env.example` in repository.

## 📖 Documentation

- Full documentation: See README.md in repository
- API documentation: `/api/docs` endpoint
- Terms of Service: `/api/legal/terms`
- Privacy Policy: `/api/legal/privacy`

## 🔒 Security

- JWT authentication
- SSO support (Google, Microsoft, GitHub, etc.)
- API token authentication
- Role-based access control
- Rate limiting

## 📄 License

MIT License - Educational and personal archival purposes

**Disclaimer**: Users responsible for legal compliance. Software provided "as is" without warranty.

## 🔗 Links

- GitHub: https://github.com/sruinz/Video-Download-to-NAS
- Issues: GitHub Issues
- Documentation: See repository README

---

**Important**: This software is a tool. You are responsible for ensuring your use complies with applicable laws and platform terms of service.
