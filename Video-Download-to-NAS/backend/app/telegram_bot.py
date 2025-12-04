"""
텔레그램 봇 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
import logging

from ..models import (
    TelegramBotSetup,
    TelegramBotUpdate,
    TelegramBotStatus,
    TelegramBotInfo,
    TelegramBotTestRequest,
    TelegramBotTestResponse
)
from ..database import get_db, User, TelegramBot, APIToken
from ..auth import get_current_user
from ..telegram.bot_manager import bot_manager
from ..telegram.encryption import TokenEncryption

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram-bot", tags=["telegram-bot"])

# 암호화 인스턴스
encryption = TokenEncryption()


def require_telegram_bot_permission(current_user: User = Depends(get_current_user)):
    """텔레그램 봇 사용 권한 확인"""
    # super_admin은 항상 허용
    if current_user.role == "super_admin":
        return current_user
    
    # can_use_telegram_bot 권한 확인
    # 0 = 역할 기본값 사용, 1 = 허용, 2 = 거부
    if current_user.can_use_telegram_bot == 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Telegram bot permission denied"
        )
    
    if current_user.can_use_telegram_bot == 1:
        return current_user
    
    # 역할 기본값 확인 (0인 경우)
    # admin과 user는 기본적으로 허용, guest는 거부
    if current_user.role in ["admin", "user"]:
        return current_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Telegram bot permission denied for your role"
    )


@router.post("/setup", response_model=TelegramBotStatus)
async def setup_bot(
    bot_setup: TelegramBotSetup,
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
):
    """텔레그램 봇 설정"""
    try:
        # 봇 토큰 검증
        test_result = await bot_manager.test_bot(bot_setup.bot_token)
        if not test_result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid bot token: {test_result.get('error')}"
            )
        
        # 기존 봇 설정 확인
        existing_bot = db.query(TelegramBot).filter(
            TelegramBot.user_id == current_user.id
        ).first()
        
        # 기존 봇이 있고 API 토큰이 암호화되어 있으면 재사용
        # 없으면 새로 생성
        api_token_value = None
        encrypted_api_token = None
        
        if existing_bot and existing_bot.api_token_encrypted:
            # 기존 봇의 암호화된 API 토큰 재사용
            encrypted_api_token = existing_bot.api_token_encrypted
            api_token = db.query(APIToken).filter(
                APIToken.id == existing_bot.api_token_id,
                APIToken.is_active == 1
            ).first()
        else:
            # API 토큰 생성 또는 기존 토큰 사용
            # 자동으로 새 API 토큰 생성 (기존 토큰이 있어도 새로 생성)
            import secrets
            import bcrypt
            from datetime import datetime
            
            api_token_value = f"vdtn_{secrets.token_urlsafe(32)}"
            token_hash = bcrypt.hashpw(api_token_value.encode(), bcrypt.gensalt()).decode()
            token_prefix = f"{api_token_value[:8]}...{api_token_value[-4:]}"
            
            api_token = APIToken(
                user_id=current_user.id,
                name="Telegram Bot",
                token_hash=token_hash,
                token_prefix=token_prefix,
                created_at=datetime.utcnow()
            )
            db.add(api_token)
            db.flush()
            
            # 새로 생성된 API 토큰 암호화
            encrypted_api_token = encryption.encrypt(api_token_value)
        
        # 봇 토큰 암호화
        encrypted_bot_token = encryption.encrypt(bot_setup.bot_token)
        
        if existing_bot:
            # 기존 봇 업데이트
            # 먼저 기존 봇 중지
            if existing_bot.status == 'running':
                await bot_manager.stop_bot(current_user.id, db)
            
            existing_bot.bot_token_encrypted = encrypted_bot_token
            existing_bot.bot_mode = bot_setup.bot_mode
            existing_bot.notifications_enabled = 1 if bot_setup.notifications_enabled else 0
            existing_bot.progress_notifications = 1 if bot_setup.progress_notifications else 0
            existing_bot.api_token_id = api_token.id
            existing_bot.api_token_encrypted = encrypted_api_token
            existing_bot.is_active = 1
            existing_bot.status = 'starting'
            existing_bot.error_message = None
            
            bot_config = existing_bot
        else:
            # 새 봇 생성
            from datetime import datetime
            
            bot_config = TelegramBot(
                user_id=current_user.id,
                bot_token_encrypted=encrypted_bot_token,
                bot_mode=bot_setup.bot_mode,
                is_active=1,
                api_token_id=api_token.id,
                api_token_encrypted=encrypted_api_token,
                status='starting',
                notifications_enabled=1 if bot_setup.notifications_enabled else 0,
                progress_notifications=1 if bot_setup.progress_notifications else 0,
                created_at=datetime.utcnow()
            )
            db.add(bot_config)
        
        db.commit()
        db.refresh(bot_config)
        
        # 봇 시작
        success = await bot_manager.start_bot(current_user.id, bot_config, db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to start bot"
            )
        
        db.refresh(bot_config)
        return bot_config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to setup bot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/status", response_model=TelegramBotStatus)
async def get_bot_status(
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
):
    """봇 상태 조회"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not configured"
        )
    
    # 실시간 상태 확인
    runtime_status = bot_manager.get_bot_status(current_user.id)
    if runtime_status['is_running'] and bot_config.status != 'running':
        bot_config.status = 'running'
        db.commit()
    elif not runtime_status['is_running'] and bot_config.status == 'running':
        bot_config.status = 'stopped'
        db.commit()
    
    return bot_config


@router.put("/", response_model=TelegramBotStatus)
async def update_bot(
    bot_update: TelegramBotUpdate,
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
):
    """봇 설정 업데이트"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not configured"
        )
    
    # 모드 변경 여부 확인
    mode_changed = False
    if bot_update.bot_mode and bot_update.bot_mode != bot_config.bot_mode:
        bot_config.bot_mode = bot_update.bot_mode
        mode_changed = True
    
    # 알림 설정 업데이트
    if bot_update.notifications_enabled is not None:
        bot_config.notifications_enabled = 1 if bot_update.notifications_enabled else 0
    
    if bot_update.progress_notifications is not None:
        bot_config.progress_notifications = 1 if bot_update.progress_notifications else 0
    
    db.commit()
    
    # 모드가 변경되었고 봇이 실행 중이면 재시작
    if mode_changed and bot_config.status == 'running':
        await bot_manager.restart_bot(current_user.id, db)
    
    db.refresh(bot_config)
    return bot_config


@router.post("/start")
async def start_bot(
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """봇 시작"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not configured"
        )
    
    if bot_config.status == 'running':
        return {"message": "Bot is already running"}
    
    bot_config.status = 'starting'
    db.commit()
    
    success = await bot_manager.start_bot(current_user.id, bot_config, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start bot"
        )
    
    return {"message": "Bot started successfully"}


@router.post("/stop")
async def stop_bot(
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """봇 중지"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not configured"
        )
    
    if bot_config.status == 'stopped':
        return {"message": "Bot is already stopped"}
    
    success = await bot_manager.stop_bot(current_user.id, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop bot"
        )
    
    return {"message": "Bot stopped successfully"}


@router.post("/reset-chat-id")
async def reset_chat_id(
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
):
    """Chat ID 초기화 - 다른 텔레그램 계정으로 변경 가능"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot configuration not found"
        )
    
    # Chat ID 초기화
    old_chat_id = bot_config.chat_id
    bot_config.chat_id = None
    db.commit()
    
    logger.info(f"Chat ID reset for user {current_user.id}: {old_chat_id} -> None")
    
    return {
        "status": "success",
        "message": "Chat ID가 초기화되었습니다. 텔레그램에서 /start를 다시 보내주세요."
    }


@router.post("/test", response_model=TelegramBotTestResponse)
async def test_bot(
    test_request: TelegramBotTestRequest,
    current_user: User = Depends(require_telegram_bot_permission)
):
    """봇 연결 테스트"""
    result = await bot_manager.test_bot(test_request.bot_token)
    
    return TelegramBotTestResponse(
        success=result.get("success", False),
        bot_username=result.get("bot_username"),
        bot_name=result.get("bot_name"),
        error=result.get("error")
    )


@router.delete("/")
async def delete_bot(
    current_user: User = Depends(require_telegram_bot_permission),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """봇 삭제"""
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == current_user.id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not configured"
        )
    
    # 봇이 실행 중이면 중지
    if bot_config.status == 'running':
        await bot_manager.stop_bot(current_user.id, db)
    
    # DB에서 삭제
    db.delete(bot_config)
    db.commit()
    
    return {"message": "Bot deleted successfully"}


# 관리자 전용 엔드포인트

@router.get("/admin/bots", response_model=List[TelegramBotInfo])
async def list_all_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 봇 조회 (관리자 전용)"""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    bots = db.query(TelegramBot).join(User).all()
    
    result = []
    for bot in bots:
        result.append(TelegramBotInfo(
            id=bot.id,
            user_id=bot.user_id,
            username=bot.user.username,
            bot_mode=bot.bot_mode,
            status=bot.status,
            last_active_at=bot.last_active_at,
            total_downloads=bot.total_downloads,
            error_message=bot.error_message
        ))
    
    return result


@router.post("/admin/bots/{user_id}/stop")
async def admin_stop_bot(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """사용자 봇 중지 (관리자 전용)"""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    bot_config = db.query(TelegramBot).filter(
        TelegramBot.user_id == user_id
    ).first()
    
    if not bot_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )
    
    success = await bot_manager.stop_bot(user_id, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop bot"
        )
    
    return {"message": f"Bot for user {user_id} stopped successfully"}
