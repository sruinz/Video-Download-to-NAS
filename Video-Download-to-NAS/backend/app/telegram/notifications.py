"""
텔레그램 알림 전송 모듈
다운로드 완료/실패/진행 상황 알림
"""
import logging
from typing import Optional, Dict
from telegram import Bot
from telegram.error import TelegramError

from ..database import SessionLocal, TelegramBot, User
from .encryption import TokenEncryption

logger = logging.getLogger(__name__)


class TelegramNotificationManager:
    """텔레그램 알림 관리자"""
    
    def __init__(self):
        self.encryption = TokenEncryption()
        self.progress_messages: Dict[str, int] = {}  # download_id -> message_id
        self.completed_downloads: set = set()  # 완료 알림을 보낸 download_id 추적
        self.last_progress_time: Dict[str, float] = {}  # download_id -> last update timestamp
        self.progress_update_interval = 1.0  # 진행률 업데이트 최소 간격 (초) - 하나의 메시지 수정
    
    async def send_download_complete_notification(
        self,
        user_id: int,
        filename: str,
        file_size: Optional[int] = None,
        download_id: Optional[str] = None
    ) -> bool:
        """다운로드 완료 알림 전송"""
        # 이미 완료 알림을 보낸 다운로드인지 확인
        if download_id and download_id in self.completed_downloads:
            logger.debug(f"Download {download_id} already notified, skipping")
            return False
        
        try:
            # 사용자의 텔레그램 봇 설정 조회
            db = SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id,
                    TelegramBot.is_active == 1,
                    TelegramBot.notifications_enabled == 1
                ).first()
                
                if not bot_config:
                    logger.debug(f"No active bot with notifications enabled for user {user_id}")
                    return False
                
                # chat_id 확인
                if not bot_config.chat_id:
                    logger.warning(f"No chat_id saved for user {user_id}. User needs to send a message to the bot first.")
                    return False
                
                # 봇 토큰 복호화
                bot_token = self.encryption.decrypt(bot_config.bot_token_encrypted)
                bot = Bot(token=bot_token)
                
                # 파일 크기 포맷팅
                size_str = ""
                if file_size:
                    if file_size < 1024:
                        size_str = f"{file_size} B"
                    elif file_size < 1024 * 1024:
                        size_str = f"{file_size / 1024:.2f} KB"
                    elif file_size < 1024 * 1024 * 1024:
                        size_str = f"{file_size / (1024 * 1024):.2f} MB"
                    else:
                        size_str = f"{file_size / (1024 * 1024 * 1024):.2f} GB"
                
                # 메시지 작성
                message = f"✅ <b>다운로드 완료</b>\n\n"
                message += f"📁 파일: <code>{filename}</code>\n"
                if size_str:
                    message += f"📊 크기: {size_str}\n"
                message += f"\n다운로드가 성공적으로 완료되었습니다!"
                
                # 진행 상황 메시지가 있으면 수정, 없으면 새로 전송
                if download_id and download_id in self.progress_messages:
                    message_id = self.progress_messages[download_id]
                    try:
                        await bot.edit_message_text(
                            chat_id=bot_config.chat_id,
                            message_id=message_id,
                            text=message,
                            parse_mode='HTML'
                        )
                        # 메시지 ID 제거
                        del self.progress_messages[download_id]
                    except TelegramError as e:
                        logger.warning(f"Failed to edit message, sending new one: {e}")
                        await bot.send_message(
                            chat_id=bot_config.chat_id,
                            text=message,
                            parse_mode='HTML'
                        )
                else:
                    await bot.send_message(
                        chat_id=bot_config.chat_id,
                        text=message,
                        parse_mode='HTML'
                    )
                
                # 완료 알림 전송 완료 표시
                if download_id:
                    self.completed_downloads.add(download_id)
                    # 시간 추적 데이터 정리
                    self.last_progress_time.pop(download_id, None)
                
                logger.info(f"Download complete notification sent to user {user_id}")
                return True
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Failed to send download complete notification to user {user_id}: {e}")
            return False
    
    async def send_download_failed_notification(
        self,
        user_id: int,
        url: str,
        error_message: str,
        download_id: Optional[str] = None
    ) -> bool:
        """다운로드 실패 알림 전송"""
        # 이미 실패 알림을 보낸 다운로드인지 확인
        if download_id and download_id in self.completed_downloads:
            logger.debug(f"Download {download_id} already notified, skipping")
            return False
        
        try:
            # 사용자의 텔레그램 봇 설정 조회
            db = SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id,
                    TelegramBot.is_active == 1,
                    TelegramBot.notifications_enabled == 1
                ).first()
                
                if not bot_config:
                    logger.debug(f"No active bot with notifications enabled for user {user_id}")
                    return False
                
                # chat_id 확인
                if not bot_config.chat_id:
                    logger.warning(f"No chat_id saved for user {user_id}. User needs to send a message to the bot first.")
                    return False
                
                # 봇 토큰 복호화
                bot_token = self.encryption.decrypt(bot_config.bot_token_encrypted)
                bot = Bot(token=bot_token)
                
                # 에러 메시지 간략화
                short_error = error_message[:200] + "..." if len(error_message) > 200 else error_message
                
                # 메시지 작성
                message = f"❌ <b>다운로드 실패</b>\n\n"
                message += f"🔗 URL: <code>{url[:50]}...</code>\n"
                message += f"⚠️ 오류: {short_error}\n"
                message += f"\n다시 시도해주세요."
                
                # 진행 상황 메시지가 있으면 수정, 없으면 새로 전송
                if download_id and download_id in self.progress_messages:
                    message_id = self.progress_messages[download_id]
                    try:
                        await bot.edit_message_text(
                            chat_id=bot_config.chat_id,
                            message_id=message_id,
                            text=message,
                            parse_mode='HTML'
                        )
                        # 메시지 ID 제거
                        del self.progress_messages[download_id]
                    except TelegramError as e:
                        logger.warning(f"Failed to edit message, sending new one: {e}")
                        await bot.send_message(
                            chat_id=bot_config.chat_id,
                            text=message,
                            parse_mode='HTML'
                        )
                else:
                    await bot.send_message(
                        chat_id=bot_config.chat_id,
                        text=message,
                        parse_mode='HTML'
                    )
                
                # 실패 알림 전송 완료 표시
                if download_id:
                    self.completed_downloads.add(download_id)
                    # 시간 추적 데이터 정리
                    self.last_progress_time.pop(download_id, None)
                
                logger.info(f"Download failed notification sent to user {user_id}")
                return True
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Failed to send download failed notification to user {user_id}: {e}")
            return False
    
    async def send_download_progress_notification(
        self,
        user_id: int,
        download_id: str,
        filename: str,
        progress: float,
        speed: Optional[float] = None,
        eta: Optional[int] = None
    ) -> bool:
        """다운로드 진행 상황 알림 전송 (1초마다 메시지 업데이트)"""
        import time
        
        # 시간 제한 체크 (1초에 한 번만 업데이트)
        current_time = time.time()
        last_time = self.last_progress_time.get(download_id, 0)
        
        if current_time - last_time < self.progress_update_interval:
            logger.debug(f"Skipping progress update for {download_id} (too soon)")
            return False
        
        # 즉시 시간 업데이트 (race condition 방지)
        self.last_progress_time[download_id] = current_time
        
        try:
            # 사용자의 텔레그램 봇 설정 조회
            db = SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id,
                    TelegramBot.is_active == 1,
                    TelegramBot.notifications_enabled == 1,
                    TelegramBot.progress_notifications == 1
                ).first()
                
                if not bot_config:
                    logger.debug(f"No active bot with progress notifications enabled for user {user_id}")
                    return False
                
                # chat_id 확인
                if not bot_config.chat_id:
                    logger.warning(f"No chat_id saved for user {user_id}. User needs to send a message to the bot first.")
                    return False
                
                # 봇 토큰 복호화
                bot_token = self.encryption.decrypt(bot_config.bot_token_encrypted)
                bot = Bot(token=bot_token)
                
                # 진행률 바 생성
                progress_bar_length = 10
                filled = int(progress / 10)
                bar = "█" * filled + "░" * (progress_bar_length - filled)
                
                # 속도 포맷팅
                speed_str = ""
                if speed:
                    if speed < 1024:
                        speed_str = f"{speed:.0f} B/s"
                    elif speed < 1024 * 1024:
                        speed_str = f"{speed / 1024:.2f} KB/s"
                    else:
                        speed_str = f"{speed / (1024 * 1024):.2f} MB/s"
                
                # ETA 포맷팅
                eta_str = ""
                if eta:
                    if eta < 60:
                        eta_str = f"{eta}초"
                    elif eta < 3600:
                        eta_str = f"{eta // 60}분 {eta % 60}초"
                    else:
                        eta_str = f"{eta // 3600}시간 {(eta % 3600) // 60}분"
                
                # 메시지 작성
                message = f"⏬ <b>다운로드 중...</b>\n\n"
                message += f"📁 파일: <code>{filename}</code>\n"
                message += f"📊 진행률: {bar} {progress:.1f}%\n"
                if speed_str:
                    message += f"⚡ 속도: {speed_str}\n"
                if eta_str:
                    message += f"⏱ 남은 시간: {eta_str}\n"
                
                # 기존 메시지가 있으면 수정, 없으면 새로 전송
                if download_id in self.progress_messages:
                    message_id = self.progress_messages[download_id]
                    # 임시 플래그 값(-1)이면 아직 메시지 생성 중 (race condition)
                    if message_id == -1:
                        logger.debug(f"Message creation in progress for {download_id}, skipping")
                        return False
                    
                    try:
                        await bot.edit_message_text(
                            chat_id=bot_config.chat_id,
                            message_id=message_id,
                            text=message,
                            parse_mode='HTML'
                        )
                    except TelegramError as e:
                        logger.warning(f"Failed to edit progress message: {e}")
                        # 메시지 수정 실패 시 새로 전송
                        sent_message = await bot.send_message(
                            chat_id=bot_config.chat_id,
                            text=message,
                            parse_mode='HTML'
                        )
                        self.progress_messages[download_id] = sent_message.message_id
                else:
                    # 즉시 임시 플래그 설정 (race condition 방지)
                    self.progress_messages[download_id] = -1
                    
                    sent_message = await bot.send_message(
                        chat_id=bot_config.chat_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    self.progress_messages[download_id] = sent_message.message_id
                
                # 마지막 업데이트 시간 기록
                self.last_progress_time[download_id] = current_time
                
                logger.debug(f"Progress notification sent to user {user_id}: {progress:.1f}%")
                return True
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Failed to send progress notification to user {user_id}: {e}")
            return False


# 전역 알림 매니저 인스턴스
notification_manager = TelegramNotificationManager()
