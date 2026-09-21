# Changelog

All notable changes to this project will be documented in this file.

## [1.1.9] - 2026-09-21

### Fixed
- Normalized fractional media durations before saving downloads so one record cannot make an entire user's library response fail validation
- Automatically repaired existing fractional duration records at backend startup; affected libraries reappear without re-download or library resynchronization

## [1.1.8-2] - 2026-09-12

### Fixed
- Restricted administrator recovery login to direct internal IP access over HTTP when local login is disabled
- Hid the administrator login button and blocked password authentication through the login and REST APIs for reverse-proxy access
- Preserved upstream proxy information in the bundled Nginx and prevented password forms from appearing before settings are verified

## [1.1.8-1] - 2026-09-03

### Fixed
- **Shared-Link Unicode Filenames**: Anonymous, download-enabled share links now deliver filenames containing Korean, Unicode, spaces, or special characters with an RFC-compliant `Content-Disposition` header

## [1.1.8] - 2026-08-30

### Added
- **Role-Based Download Request Limits**: Applied role-based limits to `/rest` and `/api/download`, with user-specific limits taking precedence over role defaults
- **Rate-Limit Response Headers**: Added response headers so clients can wait and retry after an HTTP 429 rate-limit response
- **Origin Server 429 Automatic Retry**: Automatically retries after waiting 30 or 60 seconds when an origin server returns HTTP 429

### Changed
- **Sequential Server Execution**: Download requests now execute sequentially on the server
- **Per-Request File Isolation**: Working files are isolated per request and all result files from one request are preserved

## [1.1.1] - 2024-11-18

### Fixed
- **Browser Extension Support**: Added `/rest` endpoint proxy configuration in frontend Nginx
  - Fixed issue where browser extension requests were blocked by frontend proxy
  - Added CORS headers for extension compatibility
  - Added preflight (OPTIONS) request handling
- **API Logging**: Enhanced `/rest` endpoint with detailed logging for debugging
  - Added request validation logging
  - Added authentication success/failure logging
  - Added download initiation logging

### Changed
- Improved error messages for `/rest` endpoint
  - Clear validation error when username or password is missing
  - Specific authentication failure messages

## [1.1.0] - 2024-11-15

### Added
- **SSO Authentication**: Complete Single Sign-On support
  - Google OAuth 2.0
  - Microsoft OAuth 2.0 (Azure AD)
  - GitHub OAuth 2.0
  - Synology DSM SSO
  - Authentik OIDC
  - Generic OIDC provider support
- **Display Name Feature**: Users can set custom display names
  - 20 character limit
  - Cooldown period (configurable, default 30 days)
  - Conflict detection with usernames and other display names
- **Enhanced User Management**: Improved admin controls
  - SSO provider linking
  - Email verification status
  - Last login tracking
  - Auth provider information

### Changed
- Frontend Nginx proxy for better deployment flexibility
- Improved CORS handling
- Enhanced security with SSO encryption keys

### Security
- SSO client secrets encrypted in database
- JWT tokens include SSO provider information
- State-based CSRF protection for OAuth flows

## [1.0.0] - 2024-11-01

### Added
- Initial release
- Video download from 1000+ sites via yt-dlp
- User authentication with JWT
- Role-based access control
- File sharing with password protection
- Public board for shared content
- WebSocket real-time updates
- Docker deployment support
