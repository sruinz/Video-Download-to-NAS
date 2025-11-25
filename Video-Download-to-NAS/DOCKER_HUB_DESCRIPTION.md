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

Edit `.env`:

```env
DEFAULT_USER=admin
DEFAULT_PASSWORD=your_password
DOWNLOAD_PATH=/downloads
JWT_SECRET=your_secret_key
```

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
