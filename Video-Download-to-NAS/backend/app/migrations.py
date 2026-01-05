"""
Database migration utilities for VDTN SSO implementation
"""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def column_exists(engine, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(engine, table_name: str) -> bool:
    """Check if a table exists"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def index_exists(engine, table_name: str, index_name: str) -> bool:
    """Check if an index exists on a table"""
    inspector = inspect(engine)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def migrate_sso_schema(db: Session):
    """
    Migrate database schema to support SSO authentication
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting SSO schema migration...")
    
    # 1. Add SSO columns to users table if they don't exist
    if not column_exists(engine, 'users', 'auth_provider'):
        logger.info("Adding auth_provider column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local' NOT NULL
        """))
        db.commit()
        logger.info("✓ Added auth_provider column")
    
    if not column_exists(engine, 'users', 'external_id'):
        logger.info("Adding external_id column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN external_id VARCHAR(255)
        """))
        db.commit()
        logger.info("✓ Added external_id column")
    
    if not column_exists(engine, 'users', 'email_verified'):
        logger.info("Adding email_verified column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN email_verified INTEGER DEFAULT 0 NOT NULL
        """))
        db.commit()
        logger.info("✓ Added email_verified column")
    
    if not column_exists(engine, 'users', 'display_name'):
        logger.info("Adding display_name column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN display_name VARCHAR(20)
        """))
        db.commit()
        logger.info("✓ Added display_name column")
    
    if not column_exists(engine, 'users', 'display_name_updated_at'):
        logger.info("Adding display_name_updated_at column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN display_name_updated_at TIMESTAMP
        """))
        db.commit()
        logger.info("✓ Added display_name_updated_at column")
    
    if not column_exists(engine, 'users', 'password_set_at'):
        logger.info("Adding password_set_at column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN password_set_at TIMESTAMP
        """))
        db.commit()
        logger.info("✓ Added password_set_at column")
    
    # 2. Create indexes for SSO columns
    try:
        logger.info("Creating indexes for SSO columns...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_auth_provider ON users(auth_provider)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_external_id ON users(external_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_auth_provider_external_id ON users(auth_provider, external_id)
        """))
        db.commit()
        logger.info("✓ Created SSO indexes")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
        db.rollback()
    
    # 3. Create sso_settings table if it doesn't exist
    if not table_exists(engine, 'sso_settings'):
        logger.info("Creating sso_settings table...")
        db.execute(text("""
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
        """))
        db.commit()
        logger.info("✓ Created sso_settings table")
    
    # 4. Create sso_states table if it doesn't exist
    if not table_exists(engine, 'sso_states'):
        logger.info("Creating sso_states table...")
        db.execute(text("""
            CREATE TABLE sso_states (
                id INTEGER PRIMARY KEY,
                state VARCHAR(255) UNIQUE NOT NULL,
                provider VARCHAR(50) NOT NULL,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sso_state ON sso_states(state)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sso_provider ON sso_states(provider)
        """))
        db.commit()
        logger.info("✓ Created sso_states table")
    
    # 5. Migrate existing users to 'local' auth provider
    logger.info("Migrating existing users to local auth provider...")
    result = db.execute(text("""
        UPDATE users 
        SET auth_provider = 'local', email_verified = 1
        WHERE auth_provider IS NULL OR auth_provider = ''
    """))
    db.commit()
    migrated_count = result.rowcount
    logger.info(f"✓ Migrated {migrated_count} existing users to local auth")
    
    # 6. Generate default display names for users without one
    logger.info("Generating default display names for existing users...")
    
    # Use inline function to avoid import issues
    def generate_unique_display_name_inline(db, base_name, max_length=20):
        import random
        import string
        if len(base_name) > max_length - 5:
            base_name = base_name[:max_length - 5]
        candidate = base_name
        # Check using raw SQL to avoid ORM import issues
        result = db.execute(text("""
            SELECT COUNT(*) FROM users 
            WHERE display_name = :name OR username = :name
        """), {"name": candidate}).scalar()
        if result == 0:
            return candidate
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        return f"{base_name}_{suffix}"[:max_length]
    
    # Get users without display name using raw SQL
    users_result = db.execute(text("""
        SELECT id, username FROM users 
        WHERE display_name IS NULL OR display_name = ''
    """)).fetchall()
    
    display_name_count = 0
    for user_row in users_result:
        try:
            user_id, username = user_row
            # Generate display name from username or email
            if username:
                base_name = username
                # If username is email, use part before @
                if '@' in base_name:
                    base_name = base_name.split('@')[0]
            else:
                base_name = f"user{user_id}"
            
            # Generate unique display name
            display_name = generate_unique_display_name_inline(db, base_name)
            
            # Update using raw SQL
            db.execute(text("""
                UPDATE users SET display_name = :display_name WHERE id = :user_id
            """), {"display_name": display_name, "user_id": user_id})
            
            display_name_count += 1
            logger.info(f"Generated display name '{display_name}' for user {user_id} ({username})")
        except Exception as e:
            logger.warning(f"Failed to generate display name for user {user_id}: {e}")
            continue
    
    if display_name_count > 0:
        db.commit()
        logger.info(f"✓ Generated display names for {display_name_count} users")
    else:
        logger.info("✓ No users needed display name generation")
    
    logger.info("SSO schema migration completed successfully!")
    
    return {
        "success": True,
        "migrated_users": migrated_count,
        "display_names_generated": display_name_count,
        "message": "SSO schema migration completed"
    }


def init_sso_settings(db: Session):
    """
    Initialize predefined SSO provider settings
    This creates default (disabled) configurations for common providers
    """
    from .database import SSOSettings
    import os
    
    logger.info("Initializing SSO provider settings...")
    
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    
    # Predefined providers with their default configurations
    predefined_providers = [
        {
            'provider': 'google',
            'provider_type': 'oauth2',
            'display_name': 'Google',
            'scopes': 'openid email profile',
            'authorization_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'userinfo_url': 'https://www.googleapis.com/oauth2/v2/userinfo'
        },
        {
            'provider': 'microsoft',
            'provider_type': 'oauth2',
            'display_name': 'Microsoft',
            'scopes': 'openid email profile User.Read',
            'authorization_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            'userinfo_url': 'https://graph.microsoft.com/v1.0/me'
        },
        {
            'provider': 'github',
            'provider_type': 'oauth2',
            'display_name': 'GitHub',
            'scopes': 'read:user user:email',
            'authorization_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'userinfo_url': 'https://api.github.com/user'
        },
        {
            'provider': 'synology',
            'provider_type': 'oidc',
            'display_name': 'Synology SSO',
            'scopes': 'openid email profile'
        },
        {
            'provider': 'authentik',
            'provider_type': 'oidc',
            'display_name': 'Authentik',
            'scopes': 'openid email profile'
        }
    ]
    
    created_count = 0
    for provider_data in predefined_providers:
        existing = db.query(SSOSettings).filter(
            SSOSettings.provider == provider_data['provider']
        ).first()
        
        if not existing:
            settings = SSOSettings(
                provider=provider_data['provider'],
                provider_type=provider_data['provider_type'],
                display_name=provider_data['display_name'],
                enabled=0,  # Disabled by default
                redirect_uri=f"{backend_url}/api/sso/{provider_data['provider']}/callback",
                scopes=provider_data['scopes'],
                authorization_url=provider_data.get('authorization_url'),
                token_url=provider_data.get('token_url'),
                userinfo_url=provider_data.get('userinfo_url')
            )
            db.add(settings)
            created_count += 1
            logger.info(f"✓ Created SSO settings for {provider_data['display_name']}")
    
    db.commit()
    logger.info(f"SSO provider initialization completed. Created {created_count} provider configurations.")
    
    return {
        "success": True,
        "created_count": created_count,
        "message": f"Initialized {created_count} SSO provider configurations"
    }


def cleanup_expired_sso_states(db: Session):
    """
    Clean up expired SSO state entries
    Should be run periodically (e.g., every 10 minutes)
    """
    from .database import SSOState
    
    try:
        deleted = db.query(SSOState).filter(
            SSOState.expires_at < datetime.now()
        ).delete()
        db.commit()
        
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired SSO state entries")
        
        return {"success": True, "deleted_count": deleted}
    except Exception as e:
        logger.error(f"Error cleaning up SSO states: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}



def migrate_api_tokens_schema(db: Session):
    """
    Migrate database schema to support API token authentication
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting API tokens schema migration...")
    
    # Create api_tokens table if it doesn't exist
    if not table_exists(engine, 'api_tokens'):
        logger.info("Creating api_tokens table...")
        db.execute(text("""
            CREATE TABLE api_tokens (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                token_prefix VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                last_used_at TIMESTAMP,
                is_active INTEGER DEFAULT 1 NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """))
        db.commit()
        logger.info("✓ Created api_tokens table")
        
        # Create indexes
        logger.info("Creating indexes for api_tokens table...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_active ON api_tokens(user_id, is_active)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_token_hash ON api_tokens(token_hash)
        """))
        db.commit()
        logger.info("✓ Created api_tokens indexes")
    else:
        logger.info("✓ api_tokens table already exists")
    
    logger.info("API tokens schema migration completed successfully!")
    
    return {
        "success": True,
        "message": "API tokens schema migration completed"
    }


def migrate_telegram_bots_schema(db: Session):
    """
    Migrate database schema to support Telegram bot integration
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting Telegram bots schema migration...")
    
    # 1. Add can_use_telegram_bot column to users table if it doesn't exist
    if not column_exists(engine, 'users', 'can_use_telegram_bot'):
        logger.info("Adding can_use_telegram_bot column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN can_use_telegram_bot INTEGER DEFAULT 0 NOT NULL
        """))
        db.commit()
        logger.info("✓ Added can_use_telegram_bot column")
    
    # 2. Create telegram_bots table if it doesn't exist
    if not table_exists(engine, 'telegram_bots'):
        logger.info("Creating telegram_bots table...")
        db.execute(text("""
            CREATE TABLE telegram_bots (
                id INTEGER PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                bot_token_encrypted TEXT UNIQUE NOT NULL,
                bot_mode VARCHAR(20) DEFAULT 'best' NOT NULL,
                is_active INTEGER DEFAULT 1 NOT NULL,
                api_token_id INTEGER,
                status VARCHAR(20) DEFAULT 'stopped' NOT NULL,
                error_message TEXT,
                last_active_at TIMESTAMP,
                last_error_at TIMESTAMP,
                total_downloads INTEGER DEFAULT 0 NOT NULL,
                total_messages INTEGER DEFAULT 0 NOT NULL,
                notifications_enabled INTEGER DEFAULT 1 NOT NULL,
                progress_notifications INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (api_token_id) REFERENCES api_tokens(id) ON DELETE SET NULL
            )
        """))
        db.commit()
        logger.info("✓ Created telegram_bots table")
        
        # Create indexes
        logger.info("Creating indexes for telegram_bots table...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_telegram_bots_user_id ON telegram_bots(user_id)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_telegram_bots_status ON telegram_bots(status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_telegram_bots_is_active ON telegram_bots(is_active)
        """))
        db.commit()
        logger.info("✓ Created telegram_bots indexes")
    
    # 3. Add api_token_encrypted column if it doesn't exist
    if not column_exists(engine, 'telegram_bots', 'api_token_encrypted'):
        logger.info("Adding api_token_encrypted column to telegram_bots table...")
        db.execute(text("""
            ALTER TABLE telegram_bots 
            ADD COLUMN api_token_encrypted TEXT
        """))
        db.commit()
        logger.info("✓ Added api_token_encrypted column")
    else:
        logger.info("✓ api_token_encrypted column already exists")
    
    # 4. Add chat_id column if it doesn't exist
    if not column_exists(engine, 'telegram_bots', 'chat_id'):
        logger.info("Adding chat_id column to telegram_bots table...")
        db.execute(text("""
            ALTER TABLE telegram_bots 
            ADD COLUMN chat_id BIGINT
        """))
        db.commit()
        logger.info("✓ Added chat_id column")
    else:
        logger.info("✓ chat_id column already exists")
    
    logger.info("Telegram bots schema migration completed successfully!")
    
    return {
        "success": True,
        "message": "Telegram bots schema migration completed"
    }


def migrate_user_approval_schema(db: Session):
    """
    Migrate database schema to support user approval system
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting user approval schema migration...")
    
    # 1. Check if is_active column exists
    if not column_exists(engine, 'users', 'is_active'):
        logger.info("Adding is_active column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL
        """))
        db.commit()
        logger.info("✓ Added is_active column")
    else:
        logger.info("✓ is_active column already exists")
    
    # 2. Ensure all existing users have is_active set (NULL -> 1, keep existing values)
    logger.info("Ensuring all existing users have is_active value...")
    result = db.execute(text("""
        UPDATE users 
        SET is_active = 1 
        WHERE is_active IS NULL
    """))
    db.commit()
    updated_count = result.rowcount
    if updated_count > 0:
        logger.info(f"✓ Updated {updated_count} users with NULL is_active to active status")
    else:
        logger.info("✓ All users already have is_active value set")
    
    # 3. Create index on is_active column for performance optimization
    # Note: This index is also defined in User model's __table_args__
    # We create it here for existing databases that don't have it yet
    if not index_exists(engine, 'users', 'idx_is_active'):
        try:
            logger.info("Creating index on users.is_active column...")
            db.execute(text("""
                CREATE INDEX idx_is_active ON users(is_active)
            """))
            db.commit()
            logger.info("✓ Created is_active index")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")
            db.rollback()
    else:
        logger.info("✓ idx_is_active index already exists")
    
    logger.info("User approval schema migration completed successfully!")
    
    return {
        "success": True,
        "message": "User approval schema migration completed",
        "updated_users": updated_count
    }


def migrate_folder_organization_schema(db: Session):
    """
    Migrate database schema to support folder organization feature
    Adds folder_organization_mode column to users table
    """
    engine = db.get_bind()
    
    logger.info("Starting folder organization schema migration...")
    
    # Add folder_organization_mode column if it doesn't exist
    if not column_exists(engine, 'users', 'folder_organization_mode'):
        logger.info("Adding folder_organization_mode column to users table...")
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN folder_organization_mode VARCHAR(50) DEFAULT 'root' NOT NULL
        """))
        db.commit()
        logger.info("✓ Added folder_organization_mode column")
    else:
        logger.info("✓ folder_organization_mode column already exists")
    
    logger.info("Folder organization schema migration completed successfully!")
    
    return {
        "success": True,
        "message": "Folder organization schema migration completed"
    }


def migrate_thumbnails_to_local(db: Session):
    """
    Migrate thumbnail paths from URL to local file paths
    Scans all files and updates thumbnail field to use local file if it exists
    """
    import os
    from pathlib import Path
    
    logger.info("Starting thumbnail migration to local files...")
    
    DOWNLOADS_DIR = "/app/downloads"
    
    # Get all files with URL thumbnails (starts with http)
    result = db.execute(text("""
        SELECT id, filename, thumbnail 
        FROM downloaded_files 
        WHERE thumbnail IS NOT NULL 
        AND (thumbnail LIKE 'http%' OR thumbnail LIKE 'https%')
    """)).fetchall()
    
    if not result:
        logger.info("✓ No files with URL thumbnails found")
        return {
            "success": True,
            "migrated_count": 0,
            "message": "No thumbnails to migrate"
        }
    
    logger.info(f"Found {len(result)} files with URL thumbnails")
    
    migrated_count = 0
    for file_row in result:
        file_id, filename, thumbnail_url = file_row
        
        try:
            # Get full path of the video file
            full_path = os.path.join(DOWNLOADS_DIR, filename)
            
            if not os.path.exists(full_path):
                logger.warning(f"File not found: {full_path}")
                continue
            
            # Check for local thumbnail file
            video_stem = os.path.splitext(full_path)[0]
            thumbnail_extensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif']
            
            local_thumbnail = None
            for thumb_ext in thumbnail_extensions:
                potential_thumb = video_stem + thumb_ext
                if os.path.exists(potential_thumb):
                    local_thumbnail = os.path.relpath(potential_thumb, DOWNLOADS_DIR)
                    break
            
            if local_thumbnail:
                # Update database with local thumbnail path
                db.execute(text("""
                    UPDATE downloaded_files 
                    SET thumbnail = :thumbnail 
                    WHERE id = :file_id
                """), {"thumbnail": local_thumbnail, "file_id": file_id})
                
                migrated_count += 1
                logger.info(f"✓ Migrated thumbnail for file {file_id}: {local_thumbnail}")
            else:
                logger.debug(f"No local thumbnail found for file {file_id}")
        
        except Exception as e:
            logger.warning(f"Failed to migrate thumbnail for file {file_id}: {e}")
            continue
    
    db.commit()
    logger.info(f"Thumbnail migration completed! Migrated {migrated_count} files")
    
    return {
        "success": True,
        "migrated_count": migrated_count,
        "total_checked": len(result),
        "message": f"Migrated {migrated_count} thumbnails to local files"
    }


def migrate_role_permissions_schema(db: Session):
    """
    Migrate database schema to support role-based default permissions
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting role permissions schema migration...")
    
    # Create role_permissions table if it doesn't exist
    if not table_exists(engine, 'role_permissions'):
        logger.info("Creating role_permissions table...")
        db.execute(text("""
            CREATE TABLE role_permissions (
                id INTEGER PRIMARY KEY,
                role VARCHAR(50) UNIQUE NOT NULL,
                can_download_to_nas INTEGER DEFAULT 1 NOT NULL,
                can_download_from_nas INTEGER DEFAULT 1 NOT NULL,
                can_create_share_links INTEGER DEFAULT 1 NOT NULL,
                can_view_public_board INTEGER DEFAULT 1 NOT NULL,
                can_post_to_public_board INTEGER DEFAULT 0 NOT NULL,
                can_use_telegram_bot INTEGER DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
        """))
        db.commit()
        logger.info("✓ Created role_permissions table")
        
        # Create index
        logger.info("Creating index for role_permissions table...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role)
        """))
        db.commit()
        logger.info("✓ Created role_permissions index")
        
        # Insert default role permissions
        logger.info("Inserting default role permissions...")
        
        default_permissions = [
            {
                'role': 'super_admin',
                'can_download_to_nas': 1,
                'can_download_from_nas': 1,
                'can_create_share_links': 1,
                'can_view_public_board': 1,
                'can_post_to_public_board': 1,
                'can_use_telegram_bot': 1
            },
            {
                'role': 'admin',
                'can_download_to_nas': 1,
                'can_download_from_nas': 1,
                'can_create_share_links': 1,
                'can_view_public_board': 1,
                'can_post_to_public_board': 1,
                'can_use_telegram_bot': 1
            },
            {
                'role': 'user',
                'can_download_to_nas': 1,
                'can_download_from_nas': 0,  # PC 다운로드 제한 (트래픽 문제)
                'can_create_share_links': 0,  # 공유 링크 생성 제한
                'can_view_public_board': 1,
                'can_post_to_public_board': 1,
                'can_use_telegram_bot': 0
            },
            {
                'role': 'guest',
                'can_download_to_nas': 0,
                'can_download_from_nas': 0,  # PC 다운로드 제한
                'can_create_share_links': 0,
                'can_view_public_board': 1,  # 게시판 조회만 가능
                'can_post_to_public_board': 0,
                'can_use_telegram_bot': 0
            }
        ]
        
        # Insert using raw SQL to avoid import issues
        for perm_data in default_permissions:
            db.execute(text("""
                INSERT INTO role_permissions (
                    role, can_download_to_nas, can_download_from_nas,
                    can_create_share_links, can_view_public_board,
                    can_post_to_public_board, can_use_telegram_bot,
                    created_at, updated_at
                ) VALUES (
                    :role, :can_download_to_nas, :can_download_from_nas,
                    :can_create_share_links, :can_view_public_board,
                    :can_post_to_public_board, :can_use_telegram_bot,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
            """), perm_data)
        
        db.commit()
        logger.info("✓ Inserted default role permissions")
    else:
        logger.info("✓ role_permissions table already exists")
        
        # Check if data exists, if not insert default data
        result = db.execute(text("SELECT COUNT(*) FROM role_permissions")).scalar()
        if result == 0:
            logger.info("No data found in role_permissions table, inserting defaults...")
            
            default_permissions = [
                {
                    'role': 'super_admin',
                    'can_download_to_nas': 1,
                    'can_download_from_nas': 1,
                    'can_create_share_links': 1,
                    'can_view_public_board': 1,
                    'can_post_to_public_board': 1,
                    'can_use_telegram_bot': 1
                },
                {
                    'role': 'admin',
                    'can_download_to_nas': 1,
                    'can_download_from_nas': 1,
                    'can_create_share_links': 1,
                    'can_view_public_board': 1,
                    'can_post_to_public_board': 1,
                    'can_use_telegram_bot': 1
                },
                {
                    'role': 'user',
                    'can_download_to_nas': 1,
                    'can_download_from_nas': 0,
                    'can_create_share_links': 0,
                    'can_view_public_board': 1,
                    'can_post_to_public_board': 1,
                    'can_use_telegram_bot': 0
                },
                {
                    'role': 'guest',
                    'can_download_to_nas': 0,
                    'can_download_from_nas': 0,
                    'can_create_share_links': 0,
                    'can_view_public_board': 1,
                    'can_post_to_public_board': 0,
                    'can_use_telegram_bot': 0
                }
            ]
            
            for perm_data in default_permissions:
                db.execute(text("""
                    INSERT INTO role_permissions (
                        role, can_download_to_nas, can_download_from_nas,
                        can_create_share_links, can_view_public_board,
                        can_post_to_public_board, can_use_telegram_bot,
                        created_at, updated_at
                    ) VALUES (
                        :role, :can_download_to_nas, :can_download_from_nas,
                        :can_create_share_links, :can_view_public_board,
                        :can_post_to_public_board, :can_use_telegram_bot,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                """), perm_data)
            
            db.commit()
            logger.info("✓ Inserted default role permissions")
        else:
            logger.info(f"✓ role_permissions table has {result} rows")
    
    logger.info("Role permissions schema migration completed successfully!")
    
    return {
        "success": True,
        "message": "Role permissions schema migration completed"
    }


def migrate_clear_deleted_user_display_names(db: Session):
    """
    Clear display_name for all deleted users (is_active=0) to prevent nickname conflicts
    This allows other users to reuse nicknames from deleted accounts
    """
    logger.info("Starting deleted user display name cleanup migration...")
    
    try:
        # Clear display_name for all inactive users
        result = db.execute(text("""
            UPDATE users 
            SET display_name = NULL 
            WHERE is_active = 0 AND display_name IS NOT NULL
        """))
        db.commit()
        
        cleared_count = result.rowcount
        
        if cleared_count > 0:
            logger.info(f"✓ Cleared display_name for {cleared_count} deleted users")
        else:
            logger.info("✓ No deleted users with display_name found")
        
        logger.info("Deleted user display name cleanup migration completed successfully!")
        
        return {
            "success": True,
            "cleared_count": cleared_count,
            "message": f"Cleared display_name for {cleared_count} deleted users"
        }
    except Exception as e:
        logger.error(f"Failed to clear deleted user display names: {e}")
        db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to clear deleted user display names"
        }


def migrate_video_metadata_schema(db: Session):
    """
    Migrate database schema to support video metadata display
    Adds metadata columns to downloaded_files table
    This function is idempotent and can be run multiple times safely
    """
    engine = db.get_bind()
    
    logger.info("Starting video metadata schema migration...")
    
    # Metadata columns to add (all TEXT, nullable)
    metadata_columns = {
        'resolution': 'TEXT',      # "1080p", "720p", etc.
        'video_codec': 'TEXT',     # "h264", "vp9", "av1", etc.
        'audio_codec': 'TEXT',     # "aac", "opus", "mp3", etc.
        'bitrate': 'TEXT',         # "2500k", "5000k", etc.
        'framerate': 'TEXT'        # "30", "60", etc.
    }
    
    # Check which columns exist
    result = db.execute(text("PRAGMA table_info(downloaded_files)"))
    existing_columns = [row[1] for row in result]
    
    # Add missing columns
    added_count = 0
    for column_name, column_type in metadata_columns.items():
        if column_name not in existing_columns:
            logger.info(f"Adding {column_name} column to downloaded_files table...")
            db.execute(text(f"""
                ALTER TABLE downloaded_files 
                ADD COLUMN {column_name} {column_type}
            """))
            db.commit()
            logger.info(f"✓ Added {column_name} column")
            added_count += 1
        else:
            logger.info(f"✓ {column_name} column already exists")
    
    logger.info("Video metadata schema migration completed successfully!")
    
    return {
        "success": True,
        "added_columns": added_count,
        "message": f"Video metadata schema migration completed ({added_count} columns added)"
    }
