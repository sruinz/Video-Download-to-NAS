import React, { useState } from 'react';
import { X, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateCurrentUser } from '../../api';
import showToast from '../../utils/toast';

export default function ChangeDisplayNameModal({ isOpen, onClose, currentUser, onSuccess }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate display name length
      if (displayName.trim().length > 100) {
        showToast.error(t('profile.displayNameTooLong'));
        return;
      }
      
      await updateCurrentUser({
        display_name: displayName.trim()
      });
      
      showToast.success(t('profile.displayNameUpdated'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update display name:', error);
      
      // 에러 메시지 처리
      const errorDetail = error.response?.data?.detail;
      let errorMessage = t('profile.displayNameUpdateFailed');
      
      if (errorDetail === 'DISPLAY_NAME_TAKEN') {
        errorMessage = t('profile.displayNameTaken');
      } else if (errorDetail === 'DISPLAY_NAME_CONFLICTS_USERNAME') {
        errorMessage = t('profile.displayNameConflictsUsername');
      } else if (errorDetail) {
        errorMessage = errorDetail;
      }
      
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      
      await updateCurrentUser({
        display_name: ''
      });
      
      showToast.success(t('profile.displayNameCleared'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to clear display name:', error);
      showToast.error(t('profile.displayNameUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-yt-light rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-yt-red" />
            <h2 className="text-xl font-bold">{t('profile.changeDisplayName')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yt-dark rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Info */}
          <div className="bg-yt-dark p-4 rounded-lg space-y-2">
            <div>
              <p className="text-sm text-gray-400">{t('profile.username')}</p>
              <p className="font-medium">{currentUser?.username}</p>
            </div>
            {currentUser?.display_name && (
              <div>
                <p className="text-sm text-gray-400">{t('profile.currentDisplayName')}</p>
                <p className="font-medium">{currentUser.display_name}</p>
              </div>
            )}
          </div>

          {/* Display Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('profile.newDisplayName')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('profile.displayNamePlaceholder')}
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('profile.displayNameHint')}
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              💡 {t('profile.displayNameInfo')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {currentUser?.display_name && (
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('profile.clearDisplayName')}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || displayName.trim() === currentUser?.display_name}
              className="flex-1 px-4 py-3 bg-yt-red hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('profile.updating') : t('profile.update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
