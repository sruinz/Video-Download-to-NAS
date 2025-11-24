import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, Link as LinkIcon, Settings as SettingsIcon, Globe as GlobeIcon, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AccountSettingsModal from './modals/AccountSettingsModal';
import LanguageSwitcher from './LanguageSwitcher';
import { getPendingUsersCount } from '../api';

export default function UserProfileMenu({ currentUser, onLogout, onOpenShareLinks, onOpenSettings }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const menuRef = useRef(null);
  
  // 언어에 따라 메뉴 너비 조정
  const menuWidth = i18n.language === 'en' ? 'w-64' : 'w-52';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // super_admin만 승인 대기 수 조회
  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      loadPendingCount();
      
      // 30초마다 자동 새로고침
      const interval = setInterval(loadPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const loadPendingCount = async () => {
    try {
      // 토큰이 없으면 API 호출하지 않음
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }
      
      const count = await getPendingUsersCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to load pending count:', error);
      // 에러 시 조용히 실패 (사용자에게 알림 표시 안함)
    }
  };

  if (!currentUser) {
    return null;
  }

  const handleAccountSettings = () => {
    setIsOpen(false);
    setShowAccountModal(true);
  };

  const handleAccountSuccess = () => {
    // Reload page to update user info
    window.location.reload();
  };

  const handleShareLinksClick = () => {
    setIsOpen(false);
    if (onOpenShareLinks) onOpenShareLinks();
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    // 승인 대기가 있으면 사용자 관리 탭의 승인 대기 필터로 이동
    if (onOpenSettings) {
      if (pendingCount > 0) {
        onOpenSettings('users', 'pending');
      } else {
        onOpenSettings();
      }
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-yt-light hover:bg-gray-700 rounded-lg transition-colors relative"
      >
        <div className="w-8 h-8 bg-yt-red rounded-full flex items-center justify-center text-white font-bold text-sm">
          {(currentUser.display_name || currentUser.username)[0].toUpperCase()}
        </div>
        <span className="hidden md:inline text-white">{currentUser.display_name || currentUser.username}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {/* 승인 대기 알림 배지 (프로필 버튼에 표시) */}
        {currentUser.role === 'super_admin' && pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 ${menuWidth} bg-yt-light border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50`}>
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-sm text-gray-400">{t('auth.login')}</p>
            <p className="text-white font-medium">
              {currentUser.display_name || currentUser.username}
            </p>
            {currentUser.display_name && (
              <p className="text-xs text-gray-500">@{currentUser.username}</p>
            )}
            {currentUser.email && !currentUser.display_name && (
              <p className="text-xs text-gray-500">{currentUser.email}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {currentUser.role}
            </p>
          </div>

          {/* Language Switcher */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <GlobeIcon className="w-4 h-4 text-gray-400" />
              <LanguageSwitcher />
            </div>
          </div>

          <button
            onClick={handleAccountSettings}
            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-yt-dark transition-colors"
          >
            <User className="w-4 h-4" />
            <span>{t('profile.accountSettings')}</span>
          </button>

          {currentUser.permissions?.can_create_share_links && (
            <button
              onClick={handleShareLinksClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-yt-dark transition-colors text-left"
            >
              <LinkIcon className="w-4 h-4 flex-shrink-0" />
              <span className="break-words">{t('shareLinks.title')}</span>
            </button>
          )}

          {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
            <button
              onClick={handleSettingsClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-yt-dark transition-colors relative"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>{t('settings.title')}</span>
              {/* 승인 대기 알림 배지 (super_admin만) */}
              {currentUser.role === 'super_admin' && pendingCount > 0 && (
                <span className="absolute right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-yt-dark transition-colors border-t border-gray-700"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      )}

      <AccountSettingsModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        currentUser={currentUser}
        onSuccess={handleAccountSuccess}
      />
    </div>
  );
}
