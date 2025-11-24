# Database Migrations

## Overview

The `migrations.py` module provides database migration utilities for VDTN, specifically for SSO authentication support.

## Functions

### `migrate_sso_schema(db: Session)`

Migrates the database schema to support SSO authentication. This function is **idempotent** and can be run multiple times safely.

**What it does:**
1. Adds SSO-related columns to the `users` table
2. Creates `sso_settings` table for provider configurations
3. Creates `sso_states` table for OAuth2 state management
4. Creates necessary indexes for performance
5. Migrates existing users to `auth_provider='local'`

**Returns:**
```python
{
    "success": True,
    "migrated_users": 5,  # Number of users migrated
    "message": "SSO schema migration completed"
}
```

**Usage:**
```python
from app.database import SessionLocal
from app.migrations import migrate_sso_schema

db = SessionLocal()
try:
    result = migrate_sso_schema(db)
    print(f"Migration completed: {result['migrated_users']} users migrated")
finally:
    db.close()
```

### `init_sso_settings(db: Session)`

Initializes predefined SSO provider settings with default (disabled) configurations.

**Providers initialized:**
- Google OAuth2
- Microsoft OAuth2
- GitHub OAuth2
- Synology SSO (OIDC)
- Authentik (OIDC)

**Returns:**
```python
{
    "success": True,
    "created_count": 5,  # Number of providers initialized
    "message": "Initialized 5 SSO provider configurations"
}
```

**Usage:**
```python
from app.migrations import init_sso_settings

db = SessionLocal()
try:
    result = init_sso_settings(db)
    print(f"Initialized {result['created_count']} SSO providers")
finally:
    db.close()
```

### `cleanup_expired_sso_states(db: Session)`

Cleans up expired OAuth2 state entries. Should be run periodically (e.g., every 10 minutes).

**Returns:**
```python
{
    "success": True,
    "deleted_count": 3  # Number of expired states deleted
}
```

**Usage:**
```python
from app.migrations import cleanup_expired_sso_states

db = SessionLocal()
try:
    result = cleanup_expired_sso_states(db)
    print(f"Cleaned up {result['deleted_count']} expired states")
finally:
    db.close()
```

## Automatic Migration

Migrations run automatically on server startup in `main.py`:

```python
@app.on_event("startup")
async def startup_event():
    from .migrations import migrate_sso_schema, init_sso_settings
    
    init_db()
    db = next(get_db())
    
    # Run SSO schema migration
    try:
        migrate_sso_schema(db)
        init_sso_settings(db)
        print("✅ SSO schema migration completed")
    except Exception as e:
        logger.error(f"SSO migration error: {e}")
        print(f"⚠️  SSO migration warning: {e}")
    
    db.close()
```

## Manual Migration

If you need to run migrations manually (e.g., for testing or troubleshooting):

```bash
# From server/backend directory
python -c "
from app.database import SessionLocal
from app.migrations import migrate_sso_schema, init_sso_settings

db = SessionLocal()
try:
    print('Running SSO schema migration...')
    result = migrate_sso_schema(db)
    print(f'✅ {result[\"message\"]}')
    print(f'   Migrated {result[\"migrated_users\"]} users')
    
    print('\\nInitializing SSO provider settings...')
    result = init_sso_settings(db)
    print(f'✅ {result[\"message\"]}')
    print(f'   Created {result[\"created_count\"]} provider configurations')
finally:
    db.close()
"
```

## Scheduled Cleanup

To set up periodic cleanup of expired SSO states, you can use a scheduler like APScheduler:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.migrations import cleanup_expired_sso_states

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=10)
def cleanup_job():
    db = SessionLocal()
    try:
        result = cleanup_expired_sso_states(db)
        if result['deleted_count'] > 0:
            logger.info(f"Cleaned up {result['deleted_count']} expired SSO states")
    finally:
        db.close()

# Start scheduler on app startup
@app.on_event("startup")
async def start_scheduler():
    scheduler.start()
```

## Safety Features

### Idempotency

All migration functions are idempotent:
- `column_exists()` checks if columns exist before adding
- `table_exists()` checks if tables exist before creating
- `CREATE INDEX IF NOT EXISTS` prevents duplicate indexes
- Provider initialization checks for existing records

### Error Handling

Migrations include comprehensive error handling:
- Database errors are logged and don't crash the application
- Partial migrations can be safely retried
- Rollback on errors to maintain database consistency

### Backward Compatibility

Migrations maintain full backward compatibility:
- Existing users are automatically migrated to `auth_provider='local'`
- All existing functionality continues to work
- No breaking changes to existing code

## Testing

Test migrations in a development environment:

```python
import pytest
from app.database import SessionLocal, engine, Base
from app.migrations import migrate_sso_schema, init_sso_settings

def test_sso_migration():
    # Create test database
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Run migration
        result = migrate_sso_schema(db)
        assert result['success'] == True
        
        # Verify tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert 'sso_settings' in tables
        assert 'sso_states' in tables
        
        # Verify columns exist
        columns = [col['name'] for col in inspector.get_columns('users')]
        assert 'auth_provider' in columns
        assert 'external_id' in columns
        assert 'email_verified' in columns
        
        # Initialize providers
        result = init_sso_settings(db)
        assert result['created_count'] > 0
        
    finally:
        db.close()
```

## Troubleshooting

### Migration fails with "table already exists"

This is normal if the migration has already run. The functions are idempotent and will skip existing tables/columns.

### Migration fails with "no such column"

This might happen if the migration was partially completed. Run the migration again - it will complete the missing parts.

### Users can't login after migration

Check that existing users were migrated:

```sql
SELECT username, auth_provider, email_verified FROM users;
```

All users should have `auth_provider='local'`. If not, run:

```sql
UPDATE users SET auth_provider = 'local', email_verified = 1 WHERE auth_provider IS NULL;
```

### SSO providers not initialized

Check if providers exist:

```sql
SELECT provider, display_name, enabled FROM sso_settings;
```

If empty, run `init_sso_settings(db)` manually.

## See Also

- [SSO Migration Guide](../SSO_MIGRATION_GUIDE.md) - Complete migration documentation
- [SSO Design Document](../../../.kiro/specs/sso-authentication/design.md) - Technical design
- [SSO Requirements](../../../.kiro/specs/sso-authentication/requirements.md) - Feature requirements
