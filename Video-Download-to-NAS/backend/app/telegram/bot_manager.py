"""
텔레그램 봇 매니저 - 여러 사용자의 봇을 관리
"""
from telegram import Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from typing import Dict, Any, Optional
import asyncio
import logging
from datetime import datetime, timezone

from .encryption import TokenEncryption
from .handlers import BotHandlerFactory
from ..database import SessionLocal, TelegramBot, User, APIToken

logger = logging.getLogger(__name__)


class TelegramBotManager:
    """여러 사용자의 텔레그램 봇을 관리하는 매니저"""
    
    def __init__(self):
        self.active_bots: Dict[int, Application] = {}  # user_id -> Application
        self.bot_tasks: Dict[int, asyncio.Task] = {}  # user_id -> Task
        self.restart_counts: Dict[int, int] = {}  # user_id -> restart count
        self.encryption = TokenEncryption()
        logger.info("TelegramBotManager initialized")
    
    async def start_bot(self, user_id: int, bot_config: TelegramBot, db_session=None, is_auto_restart: bool = False) -> bool:
        """사용자의 텔레그램 봇 시작"""
        try:
            # 이미 실행 중인지 확인
            if user_id in self.active_bots:
                logger.warning(f"Bot for user {user_id} is already running")
                return False
            
            # 봇 토큰 복호화
            bot_token = self.encryption.decrypt(bot_config.bot_token_encrypted)
            
            # API 토큰 복호화
            if not bot_config.api_token_encrypted:
                logger.error(f"No API token configured for user {user_id}")
                return False
            
            try:
                api_token = self.encryption.decrypt(bot_config.api_token_encrypted)
            except Exception as e:
                logger.error(f"Failed to decrypt API token for user {user_id}: {e}")
                return False
            
            # Application 생성
            application = Application.builder().token(bot_token).build()
            
            # 핸들러 생성
            handlers = BotHandlerFactory.create_handlers(
                bot_config.bot_mode,
                user_id,
                api_token
            )
            
            # 명령어 핸들러 등록
            application.add_handler(CommandHandler("start", handlers.start_command))
            
            # 메시지 핸들러 등록
            application.add_handler(
                MessageHandler(filters.TEXT & ~filters.COMMAND, handlers.handle_message)
            )
            
            # 버튼 모드인 경우 콜백 핸들러 등록
            if bot_config.bot_mode == 'button':
                application.add_handler(
                    CallbackQueryHandler(handlers.button_callback)
                )
            
            # 봇 시작
            await application.initialize()
            await application.start()
            await application.updater.start_polling()
            
            # 활성 봇 목록에 추가
            self.active_bots[user_id] = application
            
            # 모니터링 태스크 시작
            if not is_auto_restart:
                # 수동 시작인 경우 재시작 카운트 초기화
                self.restart_counts[user_id] = 0
            
            monitor_task = asyncio.create_task(self._monitor_bot(user_id))
            self.bot_tasks[user_id] = monitor_task
            
            # DB 상태 업데이트
            db = db_session or SessionLocal()
            try:
                bot_config.status = 'running'
                bot_config.last_active_at = datetime.now(timezone.utc)
                bot_config.error_message = None
                db.commit()
            finally:
                if not db_session:
                    db.close()
            
            logger.info(f"Bot started successfully for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start bot for user {user_id}: {e}")
            
            # DB 상태 업데이트
            db = db_session or SessionLocal()
            try:
                bot_config.status = 'error'
                bot_config.error_message = str(e)
                bot_config.last_error_at = datetime.utcnow()
                db.commit()
            finally:
                if not db_session:
                    db.close()
            
            return False
    
    async def _monitor_bot(self, user_id: int):
        """봇 상태 모니터링 및 크래시 감지"""
        try:
            while user_id in self.active_bots:
                # 봇이 정상 동작 중인지 확인
                await asyncio.sleep(30)  # 30초마다 체크
                
                # 봇이 여전히 활성 상태인지 확인
                if user_id not in self.active_bots:
                    break
                
                application = self.active_bots[user_id]
                
                # Application이 실행 중인지 확인
                if not application.running:
                    logger.warning(f"Bot for user {user_id} stopped unexpectedly")
                    await self._handle_bot_crash(user_id)
                    break
                    
        except asyncio.CancelledError:
            logger.info(f"Monitor task cancelled for user {user_id}")
        except Exception as e:
            logger.error(f"Monitor task error for user {user_id}: {e}")
            await self._handle_bot_crash(user_id)
    
    async def _handle_bot_crash(self, user_id: int):
        """봇 크래시 처리 및 자동 재시작"""
        try:
            # 현재 재시작 횟수 확인
            restart_count = self.restart_counts.get(user_id, 0)
            max_restarts = 5
            
            if restart_count >= max_restarts:
                logger.error(f"Bot for user {user_id} exceeded max restart attempts ({max_restarts})")
                
                # DB 상태 업데이트
                db = SessionLocal()
                try:
                    bot_config = db.query(TelegramBot).filter(
                        TelegramBot.user_id == user_id
                    ).first()
                    
                    if bot_config:
                        bot_config.status = 'error'
                        bot_config.error_message = f"봇이 {max_restarts}회 재시작 시도 후 실패했습니다. 수동으로 재시작해주세요."
                        bot_config.last_error_at = datetime.utcnow()
                        db.commit()
                finally:
                    db.close()
                
                # 봇 정리
                if user_id in self.active_bots:
                    del self.active_bots[user_id]
                if user_id in self.bot_tasks:
                    del self.bot_tasks[user_id]
                
                return
            
            # 재시작 카운트 증가
            self.restart_counts[user_id] = restart_count + 1
            
            # 지수 백오프 계산 (5초, 10초, 30초, 1분, 5분)
            backoff_delays = [5, 10, 30, 60, 300]
            delay = backoff_delays[min(restart_count, len(backoff_delays) - 1)]
            
            logger.info(f"Restarting bot for user {user_id} (attempt {restart_count + 1}/{max_restarts}) after {delay}s")
            
            # DB에 재시작 시도 기록
            db = SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id
                ).first()
                
                if bot_config:
                    bot_config.status = 'restarting'
                    bot_config.error_message = f"봇 재시작 중... (시도 {restart_count + 1}/{max_restarts})"
                    db.commit()
            finally:
                db.close()
            
            # 기존 봇 정리
            if user_id in self.active_bots:
                try:
                    application = self.active_bots[user_id]
                    await application.updater.stop()
                    await application.stop()
                    await application.shutdown()
                except Exception as e:
                    logger.error(f"Error cleaning up crashed bot for user {user_id}: {e}")
                finally:
                    del self.active_bots[user_id]
            
            if user_id in self.bot_tasks:
                del self.bot_tasks[user_id]
            
            # 백오프 대기
            await asyncio.sleep(delay)
            
            # 봇 재시작
            db = SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id
                ).first()
                
                if bot_config and bot_config.is_active:
                    success = await self.start_bot(user_id, bot_config, db, is_auto_restart=True)
                    
                    if success:
                        logger.info(f"Bot restarted successfully for user {user_id}")
                    else:
                        logger.error(f"Failed to restart bot for user {user_id}")
                        # 재귀적으로 다시 크래시 처리 (다음 재시도)
                        await self._handle_bot_crash(user_id)
                else:
                    logger.warning(f"Bot config not found or inactive for user {user_id}, skipping restart")
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error handling bot crash for user {user_id}: {e}")
    
    async def stop_bot(self, user_id: int, db_session=None) -> bool:
        """사용자의 텔레그램 봇 중지"""
        try:
            if user_id not in self.active_bots:
                logger.warning(f"Bot for user {user_id} is not running")
                return False
            
            # Application 가져오기
            application = self.active_bots[user_id]
            
            # 봇 중지
            await application.updater.stop()
            await application.stop()
            await application.shutdown()
            
            # 활성 봇 목록에서 제거
            del self.active_bots[user_id]
            
            # Task가 있으면 취소
            if user_id in self.bot_tasks:
                self.bot_tasks[user_id].cancel()
                del self.bot_tasks[user_id]
            
            # 재시작 카운트 초기화
            if user_id in self.restart_counts:
                del self.restart_counts[user_id]
            
            # DB 상태 업데이트
            db = db_session or SessionLocal()
            try:
                bot_config = db.query(TelegramBot).filter(
                    TelegramBot.user_id == user_id
                ).first()
                
                if bot_config:
                    bot_config.status = 'stopped'
                    bot_config.error_message = None
                    db.commit()
            finally:
                if not db_session:
                    db.close()
            
            logger.info(f"Bot stopped successfully for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop bot for user {user_id}: {e}")
            return False
    
    async def restart_bot(self, user_id: int, db_session=None) -> bool:
        """사용자의 텔레그램 봇 재시작"""
        logger.info(f"Restarting bot for user {user_id}")
        
        # 기존 봇 중지
        await self.stop_bot(user_id, db_session)
        
        # 잠시 대기
        await asyncio.sleep(1)
        
        # 봇 설정 가져오기
        db = db_session or SessionLocal()
        try:
            bot_config = db.query(TelegramBot).filter(
                TelegramBot.user_id == user_id
            ).first()
            
            if not bot_config:
                logger.error(f"Bot config not found for user {user_id}")
                return False
            
            # 새로 시작
            return await self.start_bot(user_id, bot_config, db)
            
        finally:
            if not db_session:
                db.close()
    
    async def test_bot(self, bot_token: str) -> Dict[str, Any]:
        """봇 연결 테스트"""
        try:
            # Bot 인스턴스 생성
            bot = Bot(token=bot_token)
            
            # getMe API 호출
            bot_info = await bot.get_me()
            
            return {
                "success": True,
                "bot_username": bot_info.username,
                "bot_name": bot_info.first_name,
                "bot_id": bot_info.id
            }
            
        except Exception as e:
            logger.error(f"Bot test failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_bot_status(self, user_id: int) -> Dict[str, Any]:
        """봇 상태 조회"""
        is_running = user_id in self.active_bots
        
        return {
            "is_running": is_running,
            "user_id": user_id
        }
    
    async def start_all_bots(self, db_session=None):
        """시스템 시작 시 모든 활성 봇 시작"""
        logger.info("Starting all active bots...")
        
        db = db_session or SessionLocal()
        try:
            # 활성화된 봇 설정 조회
            active_bots = db.query(TelegramBot).filter(
                TelegramBot.is_active == 1,
                TelegramBot.status != 'error'
            ).all()
            
            logger.info(f"Found {len(active_bots)} active bots to start")
            
            # 각 봇 시작
            for bot_config in active_bots:
                try:
                    await self.start_bot(bot_config.user_id, bot_config, db)
                except Exception as e:
                    logger.error(f"Failed to start bot for user {bot_config.user_id}: {e}")
                    continue
            
            logger.info(f"Started {len(self.active_bots)} bots successfully")
            
        finally:
            if not db_session:
                db.close()
    
    async def stop_all_bots(self):
        """시스템 종료 시 모든 봇 중지"""
        logger.info("Stopping all bots...")
        
        user_ids = list(self.active_bots.keys())
        
        for user_id in user_ids:
            try:
                await self.stop_bot(user_id)
            except Exception as e:
                logger.error(f"Failed to stop bot for user {user_id}: {e}")
                continue
        
        logger.info("All bots stopped")


# 전역 봇 매니저 인스턴스
bot_manager = TelegramBotManager()
