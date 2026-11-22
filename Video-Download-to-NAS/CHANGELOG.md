# Changelog

All notable changes to this project will be documented in this file.

## [1.1.13-1] - 2026-11-22

### Fixed
- Fixed mobile List View horizontal overflow where missing `w-full min-w-0` on `<main>` allowed long truncated filenames to stretch the library container past the mobile viewport, clipping the search bar, filter bar, and pushing row action buttons off-screen
- Improved mobile List View readability and usability by separating mobile metadata onto its own line, left-aligning mobile action buttons (`justify-start lg:justify-end`), and ensuring filter bars, Public Board, and Folder View wrap cleanly without horizontal overflow

## [1.1.13] - 2026-11-22

### Added
- Added an integrated editable **Memo / Description** section inside the Video Info modal with XSS-safe auto-linked URLs, collapsible long-text view, one-click copy, and library search support across both filenames and memos
- Expanded the Account Settings Folder Organization tab into **Save Settings** with an optional **Auto-save video description on download** toggle (default OFF) that saves standard `yt-dlp` description metadata across Web UI, browser extension, and Telegram bot downloads while preserving user-edited memos
- Highlighted the `i` info button in cyan (`text-cyan-400`) on grid cards and list rows when a file has a memo or description, without adding extra icon clutter

## [1.1.12] - 2026-11-21

### Fixed
- Fixed fullscreen 4-sided letterboxing on lower-resolution or non-16:9 aspect-ratio videos (e.g., 592p, 21:9, 10:9) by scaling `<video>` with `w-full h-full object-contain`
- Fixed standalone subtitle downloads saving `file_size` as `None` ("Unknown") and copying video thumbnails/duration onto subtitle records

### Added
- Added built-in web player subtitle playback across My Library, Public Board, and Share Links (including anonymous/password-protected shares) with on-the-fly SRT→WebVTT streaming, automatic companion subtitle matching, CC track picker, `C` keyboard shortcut, and customizable caption styling (font size, font family, text color, background opacity, and vertical position)
- Added dedicated **Subtitles** tab in Account Settings for server-wide automatic subtitle co-downloading (multi-language selection, SRT/VTT format, auto-generated captions) across Web UI, browser extension, and Telegram bot, alongside browser player display preferences
- Improved library organization by hiding standalone subtitle items from `All Types`, rendering a clean `CC` language badge on videos with matching subtitles, and displaying dedicated subtitle cards (`SRT · KO`) in the `Subtitle` tab

## [1.1.11] - 2026-11-21

### Added
- Added Grid, List (with sortable column headers), and Folder views (actual NAS paths plus grouping by Month, Site, or Uploader) for both My Library and Public Board while preserving all file actions across every view
- Added switchable Infinite Scroll and Pagination browse modes with configurable items per page (`12 / 24 / 48 / 96`) persisted in `localStorage`
- Added Repeat (`Off / Repeat All / Repeat One`) and Shuffle playback controls with playlist history to the media player, and enabled playlist playback on Public Board
- Added Buy Me a Coffee support links to the footer and Account Settings modal with full i18n support

## [1.1.10] - 2026-11-01

### Fixed
- Fixed an issue where downloads requested with URLs or video IDs as the filename parameter resulted in distorted final filenames (e.g., `watch_v=...` or video IDs)
- Strengthened backend output filename validation to preserve yt-dlp extracted video titles when requested filenames are invalid or suspicious

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
