"""
SSO State Cleanup Scheduler

This module provides a background scheduler to periodically clean up
expired SSO state parameters from the database.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.database import SessionLocal
from app.sso.security import cleanup_expired_states

logger = logging.getLogger(__name__)

# Create scheduler instance
scheduler = AsyncIOScheduler()


def cleanup_expired_states_job():
    """
    Background job to clean up expired SSO states.
    
    This job runs every 10 minutes to remove expired state parameters
    from the database, preventing database bloat and ensuring security.
    """
    db = SessionLocal()
    try:
        expired_count = cleanup_expired_states(db)
        if expired_count > 0:
            logger.info(f"SSO state cleanup job: removed {expired_count} expired states")
    except Exception as e:
        logger.error(f"SSO state cleanup job failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """
    Start the background scheduler for SSO maintenance tasks.
    
    This should be called during application startup.
    """
    try:
        # Schedule cleanup job to run every 10 minutes
        scheduler.add_job(
            cleanup_expired_states_job,
            trigger=IntervalTrigger(minutes=10),
            id='cleanup_expired_sso_states',
            name='Cleanup expired SSO states',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("SSO state cleanup scheduler started (runs every 10 minutes)")
        
    except Exception as e:
        logger.error(f"Failed to start SSO scheduler: {e}")


def stop_scheduler():
    """
    Stop the background scheduler.
    
    This should be called during application shutdown.
    """
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("SSO state cleanup scheduler stopped")
    except Exception as e:
        logger.error(f"Failed to stop SSO scheduler: {e}")
