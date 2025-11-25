from fastapi import WebSocket
from typing import Dict
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time download updates"""
    
    def __init__(self):
        # Map user_id to WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        # Track connection statistics
        self.connection_stats = {
            'total_connections': 0,
            'total_disconnections': 0,
            'replaced_connections': 0
        }
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """
        Connect a WebSocket for a specific user.
        Only one connection per user is allowed.
        """
        await websocket.accept()
        
        # If user already has a connection, close it with special code
        if user_id in self.active_connections:
            try:
                old_ws = self.active_connections[user_id]
                # Use custom close code 4000 to indicate "replaced"
                await old_ws.close(code=4000, reason="Replaced by new connection")
                self.connection_stats['replaced_connections'] += 1
                logger.info(f"Replaced existing connection for user {user_id}")
            except Exception as e:
                logger.warning(f"Error closing old connection for user {user_id}: {e}")
        
        self.active_connections[user_id] = websocket
        self.connection_stats['total_connections'] += 1
        logger.info(f"WebSocket connected for user {user_id} (total: {len(self.active_connections)})")
    
    def disconnect(self, user_id: int):
        """Remove WebSocket connection for a user"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            self.connection_stats['total_disconnections'] += 1
            logger.info(f"WebSocket disconnected for user {user_id} (remaining: {len(self.active_connections)})")
    
    async def send_personal_message(self, user_id: int, message: dict):
        """Send a message to a specific user's WebSocket"""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                # Remove dead connection
                self.disconnect(user_id)
    
    async def send_progress(self, user_id: int, download_id: str, data: dict):
        """Send download progress update to a specific user"""
        message = {
            "event": "download_progress",
            "download_id": download_id,
            **data
        }
        await self.send_personal_message(user_id, message)
    
    async def send_download_started(self, user_id: int, download_id: str, url: str, resolution: str, filename: str):
        """Notify user that download has started"""
        message = {
            "event": "download_started",
            "download_id": download_id,
            "url": url,
            "resolution": resolution,
            "filename": filename
        }
        logger.info(f"Sending download_started event to user {user_id}: {download_id}")
        await self.send_personal_message(user_id, message)
    
    async def send_download_completed(self, user_id: int, download_id: str, filename: str, file_id: int, file_size: int):
        """Notify user that download has completed"""
        message = {
            "event": "download_completed",
            "download_id": download_id,
            "filename": filename,
            "file_id": file_id,
            "file_size": file_size
        }
        logger.info(f"Sending download_completed event to user {user_id}: {download_id}")
        await self.send_personal_message(user_id, message)
    
    async def send_download_failed(self, user_id: int, download_id: str, error: str, error_type: str = "unknown"):
        """Notify user that download has failed"""
        message = {
            "event": "download_failed",
            "download_id": download_id,
            "error": error,
            "error_type": error_type
        }
        await self.send_personal_message(user_id, message)
    
    def is_connected(self, user_id: int) -> bool:
        """Check if a user has an active WebSocket connection"""
        return user_id in self.active_connections
    
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.active_connections)
    
    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            'active_connections': len(self.active_connections),
            **self.connection_stats
        }


# Global connection manager instance
manager = ConnectionManager()
