# SSO Database Migration Guide

## Overview

This guide explains the database schema changes for SSO (Single Sign-On) authentication support in VDTN.

## What's Changed

### 1. Users Table Extensions

Three new columns have been added to the `users` table:

- **auth_provider** (VARCHAR): Identifies the authentication method
  - Values: `'local'`, `'google'`, `'microsoft'`, `'github'`, `'synology'`, `'authentik'`, `'generic_oidc'`
  - Default: `'local'`
  - Indexed for fast lookups

- **external_id** (VARCHAR): Stores the OAuth2 provider's user ID
  - Nullable (only used for SSO users)
  - Indexed for fast lookups

- **email_verified** (INTEGER): Email verification status
  - Values: `0` (not verified), `1` (verified)
  - Default: `0`

### 2. New Tables

#### sso_settings
Stores OAuth2/OIDC provider configurations:

```sql
CREATE TABLE sso_settings (
    id INTEGER PRIMARY KEY,
    provider VARCHAR(50) UNIQUE NOT NULL,
    provider_type VARCHAR(20) DEFAULT 'oauth2' NOT NULL,
    enabled INTEGER DEFAULT 0 NOT NULL,
    client_id VARCHAR(255),
    client_secret_encrypted TEXT,
    redirect_uri VARCHAR(500),
    scopes VARCHAR(500),
    authorization_url VARCHAR(500),
    token_url VARCHAR(500),
    userinfo_url VARCHAR(500),
    discovery_url VARCHAR(500),
    display_name VARCHAR(100),
    icon_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)
```

#### sso_states
Temporary storage for OAuth2 state parameters (CSRF protection):

```sql
CREATE TABLE sso_states (
    id INTEGER PRIMARY KEY,
    state VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### 3. Indexes

New indexes for performance:
- `idx_auth_provider` on `users(auth_provider)`
- `idx_external_id` on `users(external_id)`
- `idx_auth_provider_external_id` on `users(auth_provider, external_id)`
- `idx_sso_state` on `sso_states(state)`
- `idx_sso_provider` on `sso_states(provider)`

## Migration Process

### Automatic Migration

The migration runs automatically on server startup via `app/migrations.py`:

1. **Schema Updates**: Adds new columns and tables if they don't exist
2. **Data Migration**: Sets `auth_provider='local'` and `email_verified=1` for existing users
3. **Provider Initialization**: Creates default (disabled) configurations for:
   - Google OAuth2
   - Microsoft OAuth2
   - GitHub OAuth2
   - Synology SSO
   - Authentik

### Manual Migration (if needed)

If you need to run the migration manually:

```python
from app.database import SessionLocal
from app.migrations import migrate_sso_schema, init_sso_settings

db = SessionLocal()
try:
    # Run schema migration
    result = migrate_sso_schema(db)
    print(result)
    
    # Initialize SSO provider settings
    result = init_sso_settings(db)
    print(result)
finally:
    db.close()
```

## Environment Variables

Add these to your `.env` file:

```bash
# SSO Encryption Key (generate with: python app/generate_sso_key.py)
SSO_ENCRYPTION_KEY=your-generated-key-here

# Backend URL (for OAuth2 redirect URIs)
BACKEND_URL=http://localhost:8000

# Frontend URL (for post-auth redirects)
FRONTEND_URL=http://localhost:3000

# Force HTTPS (recommended for production)
FORCE_HTTPS=false
```

### Generate Encryption Key

```bash
python server/backend/app/generate_sso_key.py
```

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing users continue to work with local authentication
- All existing functionality remains unchanged
- SSO is opt-in and disabled by default
- Users can use both local and SSO authentication simultaneously

## Verification

After migration, verify the changes:

```sql
-- Check users table structure
PRAGMA table_info(users);

-- Check existing users were migrated
SELECT username, auth_provider, email_verified FROM users;

-- Check SSO settings were initialized
SELECT provider, display_name, enabled FROM sso_settings;
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Remove SSO columns from users table
ALTER TABLE users DROP COLUMN auth_provider;
ALTER TABLE users DROP COLUMN external_id;
ALTER TABLE users DROP COLUMN email_verified;

-- Drop SSO tables
DROP TABLE sso_settings;
DROP TABLE sso_states;
```

**Note**: SQLite doesn't support `DROP COLUMN`, so you may need to recreate the users table without SSO columns.

## Troubleshooting

### Migration fails on startup

Check the logs for specific errors. Common issues:
- Database file permissions
- Corrupted database
- Missing dependencies

### Existing users can't login

The migration sets all existing users to `auth_provider='local'`, so they should continue to work. If not:

```sql
UPDATE users SET auth_provider = 'local', email_verified = 1 WHERE auth_provider IS NULL;
```

### SSO providers not showing

Check that provider settings were initialized:

```sql
SELECT * FROM sso_settings;
```

If empty, run:

```python
from app.migrations import init_sso_settings
init_sso_settings(db)
```

## Next Steps

After successful migration:

1. Generate and set `SSO_ENCRYPTION_KEY` in `.env`
2. Configure OAuth2 applications with providers (Google, Microsoft, GitHub)
3. Enable and configure SSO providers in admin settings
4. Test SSO login flow

## Support

For issues or questions, refer to:
- Main documentation: `server/README.md`
- SSO design document: `.kiro/specs/sso-authentication/design.md`
- SSO requirements: `.kiro/specs/sso-authentication/requirements.md`
