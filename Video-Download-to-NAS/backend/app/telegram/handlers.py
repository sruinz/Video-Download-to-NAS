"""
텔레그램 봇 핸들러 모듈
"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from typing import Dict, Any
import os
import re
import logging
import aiohttp

logger = logging.getLogger(__name__)


class BaseBotHandlers:
    """봇 핸들러 기본 클래스"""
    
    def __init__(self, user_id: int, api_token: str):
        self.user_id = user_id
        self.api_token = api_token
        self.api_url = os.getenv("API_URL", "http://localhost:8000")
    
    async def save_chat_id(self, chat_id: int):
        """사용자의 chat_id를 데이터베이스에 저장 (처음 한 번만)"""
        from ..database import SessionLocal, TelegramBot
        
        db = SessionLocal()
        try:
            bot_config = db.query(TelegramBot).filter(
                TelegramBot.user_id == self.user_id
            ).first()
            
            if bot_config:
                # chat_id가 없으면 저장 (처음 /start 한 사용자)
                if bot_config.chat_id is None:
                    bot_config.chat_id = chat_id
                    db.commit()
                    logger.info(f"Registered chat_id {chat_id} for user {self.user_id} (first time)")
                # 이미 chat_id가 있으면 변경하지 않음 (보안)
                elif bot_config.chat_id != chat_id:
                    logger.warning(f"Attempted to change chat_id from {bot_config.chat_id} to {chat_id} for user {self.user_id} - rejected")
        except Exception as e:
            logger.error(f"Failed to save chat_id: {e}")
        finally:
            db.close()
    
    async def is_authorized_chat(self, chat_id: int) -> bool:
        """chat_id가 허용된 사용자인지 확인"""
        from ..database import SessionLocal, TelegramBot
        
        db = SessionLocal()
        try:
            bot_config = db.query(TelegramBot).filter(
                TelegramBot.user_id == self.user_id
            ).first()
            
            if not bot_config:
                return False
            
            # chat_id가 설정되지 않았으면 허용 (첫 사용자)
            if bot_config.chat_id is None:
                return True
            
            # 저장된 chat_id와 일치하는지 확인
            return bot_config.chat_id == chat_id
        except Exception as e:
            logger.error(f"Failed to check chat authorization: {e}")
            return False
        finally:
            db.close()
    
    async def update_stats(self, message_received: bool = False, download_requested: bool = False):
        """봇 통계 업데이트"""
        from ..database import SessionLocal, TelegramBot
        from datetime import datetime, timezone
        
        db = SessionLocal()
        try:
            bot_config = db.query(TelegramBot).filter(
                TelegramBot.user_id == self.user_id
            ).first()
            
            if bot_config:
                # 마지막 활동 시간 업데이트 (UTC)
                bot_config.last_active_at = datetime.now(timezone.utc)
                
                # 메시지 카운트 증가
                if message_received:
                    bot_config.total_messages += 1
                
                # 다운로드 카운트 증가
                if download_requested:
                    bot_config.total_downloads += 1
                
                db.commit()
                logger.info(f"Stats updated for user {self.user_id}: messages={bot_config.total_messages}, downloads={bot_config.total_downloads}")
        except Exception as e:
            logger.error(f"Failed to update stats for user {self.user_id}: {e}")
            db.rollback()
        finally:
            db.close()
        
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/start 명령어 처리"""
        chat_id = update.effective_chat.id
        
        # 인증 확인
        is_authorized = await self.is_authorized_chat(chat_id)
        
        if not is_authorized:
            # 이미 다른 사용자가 등록된 경우
            unauthorized_message = (
                "⛔ 이 봇은 이미 다른 사용자에게 등록되어 있습니다.\n"
                "봇 소유자만 사용할 수 있습니다."
            )
            await update.message.reply_text(unauthorized_message)
            logger.warning(f"Unauthorized /start attempt from chat_id {chat_id} for user {self.user_id}")
            return
        
        # chat_id 저장 (처음 사용자인 경우)
        await self.save_chat_id(chat_id)
        
        # 통계 업데이트 (메시지 수신)
        await self.update_stats(message_received=True)
        
        welcome_message = (
            "🎬 Video Download to NAS Bot에 오신 것을 환영합니다!\n\n"
            "✅ 이 텔레그램 계정이 봇 소유자로 등록되었습니다.\n"
            "🔒 보안을 위해 이 계정만 봇을 사용할 수 있습니다.\n\n"
            "비디오 URL을 보내주시면 다운로드를 시작합니다.\n"
            "YouTube, Vimeo 등 1000개 이상의 사이트를 지원합니다.\n\n"
            "사용 방법:\n"
            "1. 다운로드하고 싶은 비디오 URL을 보내주세요\n"
            "2. 다운로드가 완료되면 알림을 받습니다\n"
            "3. 웹 UI에서 다운로드된 파일을 확인하세요\n\n"
            "💡 다른 텔레그램 계정으로 변경하려면 웹 UI에서 'Chat ID 초기화'를 클릭하세요."
        )
        await update.message.reply_text(welcome_message)
        
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """메시지 처리 (추상 메서드)"""
        raise NotImplementedError("Subclasses must implement handle_message")
        
    async def send_download_request(self, url: str, resolution: str) -> Dict[str, Any]:
        """
        다운로드 API 호출
        
        이 메서드는 /rest API 엔드포인트를 호출하며, 해당 엔드포인트는
        download_video() 함수를 통해 path_helper.get_user_download_path()를 사용하여
        사용자의 폴더 구성 설정에 따라 다운로드 경로를 결정합니다.
        
        이를 통해 텔레그램 봇 다운로드와 웹 UI 다운로드가 동일한 폴더 구성 로직을 사용하여
        일관된 동작을 보장합니다.
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}/rest",
                    json={
                        "url": url,
                        "resolution": resolution,
                        "token": self.api_token
                    },
                    headers={
                        "Content-Type": "application/json"
                    }
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        logger.error(f"Download request failed: {response.status} - {error_text}")
                        return {
                            "success": False,
                            "error": f"다운로드 요청 실패: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Failed to send download request: {e}")
            return {
                "success": False,
                "error": f"다운로드 요청 중 오류 발생: {str(e)}"
            }
    
    def is_valid_url(self, url: str) -> bool:
        """URL 유효성 검사"""
        # 기본 URL 패턴 검사
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        return url_pattern.match(url) is not None



class ButtonModeHandlers(BaseBotHandlers):
    """선택 모드 핸들러 - 사용자가 해상도를 선택"""
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """URL 받고 해상도 선택 버튼 표시"""
        chat_id = update.effective_chat.id
        
        # 인증 확인
        if not await self.is_authorized_chat(chat_id):
            await update.message.reply_text(
                "⛔ 이 봇은 이미 다른 사용자에게 등록되어 있습니다.\n"
                "봇 소유자만 사용할 수 있습니다."
            )
            logger.warning(f"Unauthorized message from chat_id {chat_id} for user {self.user_id}")
            return
        
        # 통계 업데이트 (메시지 수신)
        await self.update_stats(message_received=True)
        
        message_text = update.message.text.strip()
        
        # URL 유효성 검사
        if not self.is_valid_url(message_text):
            await update.message.reply_text(
                "❌ 유효하지 않은 URL입니다.\n"
                "올바른 비디오 URL을 보내주세요."
            )
            return
        
        # URL을 context에 저장
        context.user_data['pending_url'] = message_text
        
        # 해상도 선택 버튼 생성
        keyboard = [
            [
                InlineKeyboardButton("🎬 Best (최고 화질)", callback_data="res_best"),
            ],
            [
                InlineKeyboardButton("📺 2160p (4K)", callback_data="res_2160"),
                InlineKeyboardButton("🖥️ 1440p (2K)", callback_data="res_1440"),
            ],
            [
                InlineKeyboardButton("💻 1080p (FHD)", callback_data="res_1080"),
                InlineKeyboardButton("📱 720p (HD)", callback_data="res_720"),
            ],
            [
                InlineKeyboardButton("📹 480p", callback_data="res_480"),
                InlineKeyboardButton("📱 360p", callback_data="res_360"),
            ],
            [
                InlineKeyboardButton("📱 240p", callback_data="res_240"),
                InlineKeyboardButton("📱 144p", callback_data="res_144"),
            ],
            [
                InlineKeyboardButton("🎵 Audio Only (M4A)", callback_data="res_audio"),
                InlineKeyboardButton("🎶 MP3", callback_data="res_mp3"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            f"📥 다운로드할 해상도를 선택하세요:\n\n"
            f"URL: {message_text[:50]}...",
            reply_markup=reply_markup
        )
    
    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """해상도 선택 버튼 클릭 처리"""
        query = update.callback_query
        chat_id = query.message.chat_id
        
        # 인증 확인
        if not await self.is_authorized_chat(chat_id):
            await query.answer("⛔ 권한이 없습니다", show_alert=True)
            logger.warning(f"Unauthorized button click from chat_id {chat_id} for user {self.user_id}")
            return
        
        await query.answer()
        
        # 다운로드 요청 시 통계 업데이트
        await self.update_stats(download_requested=True)
        
        # URL 가져오기
        url = context.user_data.get('pending_url')
        if not url:
            await query.edit_message_text("❌ URL 정보를 찾을 수 없습니다. 다시 시도해주세요.")
            return
        
        # 해상도 매핑
        resolution_map = {
            "res_best": "best",
            "res_2160": "2160",
            "res_1440": "1440",
            "res_1080": "1080",
            "res_720": "720",
            "res_480": "480",
            "res_360": "360",
            "res_240": "240",
            "res_144": "144",
            "res_audio": "audio",
            "res_mp3": "audio-mp3"
        }
        
        resolution = resolution_map.get(query.data, "best")
        resolution_text = query.data.replace("res_", "").upper()
        
        # 다운로드 시작 메시지
        await query.edit_message_text(
            f"⏳ 다운로드를 시작합니다...\n\n"
            f"해상도: {resolution_text}\n"
            f"URL: {url[:50]}..."
        )
        
        # 다운로드 요청
        result = await self.send_download_request(url, resolution)
        
        # /rest 엔드포인트는 status: "success"를 반환
        if result.get("status") == "success":
            await query.message.reply_text(
                f"✅ 다운로드가 시작되었습니다!\n"
                f"완료되면 알림을 보내드립니다."
            )
        else:
            error_msg = result.get("error", "알 수 없는 오류")
            await query.message.reply_text(
                f"❌ 다운로드 실패\n\n"
                f"오류: {error_msg}"
            )
        
        # URL 정보 삭제
        context.user_data.pop('pending_url', None)


class BestModeHandlers(BaseBotHandlers):
    """베스트 모드 핸들러 - 항상 최고 화질로 다운로드"""
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """URL 받고 즉시 best 해상도로 다운로드"""
        chat_id = update.effective_chat.id
        
        # 인증 확인
        if not await self.is_authorized_chat(chat_id):
            await update.message.reply_text(
                "⛔ 이 봇은 이미 다른 사용자에게 등록되어 있습니다.\n"
                "봇 소유자만 사용할 수 있습니다."
            )
            logger.warning(f"Unauthorized message from chat_id {chat_id} for user {self.user_id}")
            return
        
        # 통계 업데이트 (메시지 수신)
        await self.update_stats(message_received=True)
        
        message_text = update.message.text.strip()
        
        # URL 유효성 검사
        if not self.is_valid_url(message_text):
            await update.message.reply_text(
                "❌ 유효하지 않은 URL입니다.\n"
                "올바른 비디오 URL을 보내주세요."
            )
            return
        
        # 다운로드 요청 시 통계 업데이트
        await self.update_stats(download_requested=True)
        
        # 다운로드 시작 메시지
        await update.message.reply_text(
            f"⏳ 최고 화질로 다운로드를 시작합니다...\n\n"
            f"URL: {message_text[:50]}..."
        )
        
        # 다운로드 요청
        result = await self.send_download_request(message_text, "best")
        
        if result.get("status") == "success":
            await update.message.reply_text(
                f"✅ 다운로드가 시작되었습니다!\n"
                f"완료되면 알림을 보내드립니다."
            )
        else:
            error_msg = result.get("error", "알 수 없는 오류")
            await update.message.reply_text(
                f"❌ 다운로드 실패\n\n"
                f"오류: {error_msg}"
            )


class MP3ModeHandlers(BaseBotHandlers):
    """MP3 모드 핸들러 - 항상 MP3로 다운로드"""
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """URL 받고 즉시 MP3로 다운로드"""
        chat_id = update.effective_chat.id
        
        # 인증 확인
        if not await self.is_authorized_chat(chat_id):
            await update.message.reply_text(
                "⛔ 이 봇은 이미 다른 사용자에게 등록되어 있습니다.\n"
                "봇 소유자만 사용할 수 있습니다."
            )
            logger.warning(f"Unauthorized message from chat_id {chat_id} for user {self.user_id}")
            return
        
        # 통계 업데이트 (메시지 수신)
        await self.update_stats(message_received=True)
        
        message_text = update.message.text.strip()
        
        # URL 유효성 검사
        if not self.is_valid_url(message_text):
            await update.message.reply_text(
                "❌ 유효하지 않은 URL입니다.\n"
                "올바른 비디오 URL을 보내주세요."
            )
            return
        
        # 다운로드 요청 시 통계 업데이트
        await self.update_stats(download_requested=True)
        
        # 다운로드 시작 메시지
        await update.message.reply_text(
            f"⏳ MP3로 다운로드를 시작합니다...\n\n"
            f"URL: {message_text[:50]}..."
        )
        
        # 다운로드 요청
        result = await self.send_download_request(message_text, "audio-mp3")
        
        if result.get("status") == "success":
            await update.message.reply_text(
                f"✅ 다운로드가 시작되었습니다!\n"
                f"완료되면 알림을 보내드립니다."
            )
        else:
            error_msg = result.get("error", "알 수 없는 오류")
            await update.message.reply_text(
                f"❌ 다운로드 실패\n\n"
                f"오류: {error_msg}"
            )


class BotHandlerFactory:
    """봇 모드별 핸들러 생성 팩토리"""
    
    @staticmethod
    def create_handlers(bot_mode: str, user_id: int, api_token: str):
        """봇 모드에 따른 핸들러 반환"""
        if bot_mode == 'button':
            return ButtonModeHandlers(user_id, api_token)
        elif bot_mode == 'best':
            return BestModeHandlers(user_id, api_token)
        elif bot_mode == 'mp3':
            return MP3ModeHandlers(user_id, api_token)
        else:
            raise ValueError(f"Unknown bot mode: {bot_mode}")
