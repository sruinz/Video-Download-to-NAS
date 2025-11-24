import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LibrarySyncModal({ isOpen, onClose, onConfirm, users }) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedUserId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-yt-light rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">{t('settings.librarySync.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-400 mb-4">{t('settings.librarySync.description')}</p>

          {/* User Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('settings.librarySync.selectUser')}
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 bg-yt-dark border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">{t('settings.librarySync.allUsers')}</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>

          {/* Warning */}
          {!selectedUserId && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-300">
                ⚠️ {t('settings.librarySync.confirm.allUsersWarning')}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
            >
              {t('settings.librarySync.startSync')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
