"""
역할 권한 관리 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from pydantic import BaseModel

from ..database import get_db, RolePermissions
from ..auth import get_current_user, User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/role-permissions", tags=["role-permissions"])


class RolePermissionsUpdate(BaseModel):
    can_download_to_nas: int
    can_download_from_nas: int
    can_create_share_links: int
    can_view_public_board: int
    can_post_to_public_board: int
    can_use_telegram_bot: int


class RolePermissionsResponse(BaseModel):
    role: str
    can_download_to_nas: int
    can_download_from_nas: int
    can_create_share_links: int
    can_view_public_board: int
    can_post_to_public_board: int
    can_use_telegram_bot: int
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[RolePermissionsResponse])
async def get_all_role_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 역할의 기본 권한 조회 (super_admin만 가능)"""
    if current_user.role != 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can view role permissions"
        )
    
    permissions = db.query(RolePermissions).all()
    return permissions


@router.get("/{role}", response_model=RolePermissionsResponse)
async def get_role_permissions(
    role: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 역할의 기본 권한 조회"""
    if current_user.role != 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can view role permissions"
        )
    
    permissions = db.query(RolePermissions).filter(
        RolePermissions.role == role
    ).first()
    
    if not permissions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permissions for role '{role}' not found"
        )
    
    return permissions


@router.put("/{role}", response_model=RolePermissionsResponse)
async def update_role_permissions(
    role: str,
    permissions_update: RolePermissionsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """역할의 기본 권한 업데이트 (super_admin만 가능)"""
    if current_user.role != 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can update role permissions"
        )
    
    # super_admin 역할은 수정 불가
    if role == 'super_admin':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify super_admin permissions"
        )
    
    permissions = db.query(RolePermissions).filter(
        RolePermissions.role == role
    ).first()
    
    if not permissions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permissions for role '{role}' not found"
        )
    
    # 권한 업데이트
    permissions.can_download_to_nas = permissions_update.can_download_to_nas
    permissions.can_download_from_nas = permissions_update.can_download_from_nas
    permissions.can_create_share_links = permissions_update.can_create_share_links
    permissions.can_view_public_board = permissions_update.can_view_public_board
    permissions.can_post_to_public_board = permissions_update.can_post_to_public_board
    permissions.can_use_telegram_bot = permissions_update.can_use_telegram_bot
    
    db.commit()
    db.refresh(permissions)
    
    logger.info(f"Role permissions updated for '{role}' by {current_user.username}")
    
    return permissions
