import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bot, Play, Square, AlertCircle, CheckCircle, Clock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAllTelegramBots, adminStopTelegramBot } from '../api';
import showToast from '../utils/toast';
import UserProfileMenu from '../components/UserProfileMenu';
import i18n from 'i18next';

export default function TelegramBotManagement({ onClose, currentUser, onLogout, onOpenSettings }) {
  const { t } = useTranslation();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stoppingBotId, setStoppingBotId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, userId: null, username: '' });

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await getAllTelegramBots();
      setBots(data);
    } catch (error) {
      console.error('Failed to load bots:', error);
      showToast.error(t('telegramBot.admin.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async () => {
    const { userId } = confirmModal;
    
    try {
      setStoppingBotId(userId);
      setConfirmModal({ show: false, userId: null, username: '' });
      await adminStopTelegramBot(userId);
      showToast.success(t('telegramBot.admin.stopSuccess'));
      await loadBots();
    } catch (error) {
      console.error('Failed to stop bot:', error);
      showToast.error(t('telegramBot.admin.stopFailed'));
    } finally {
      setStoppingBotId(null);
    }
  };

  const showStopConfirm = (userId, username) => {
    setConfirmModal({ show: true, userId, username });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
        return <Square className="w-5 h-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'starting':
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return <Square className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running':
        return t('telegramBot.status.running');
      case 'stopped':
        return t('telegramBot.status.stopped');
      case 'error':
        return t('telegramBot.status.error');
      case 'starting':
        return t('telegramBot.status.starting');
      default:
        return status;
    }
  };

  const getModeText = (mode) => {
    return t(`telegramBot.mode.${mode}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('telegramBot.time.justNow');
    if (diffMins < 60) return t('telegramBot.time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('telegramBot.time.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('telegramBot.time.daysAgo', { count: diffDays });
    
    // 7일 이상이면 날짜 표시 (로케일 적용)
    return date.toLocaleDateString(i18n.language);
  };

  return (
    <div className="min-h-screen bg-yt-darker">
      {/* Header */}
      <header className="bg-yt-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={onClose}
                className="p-2 hover:bg-yt-light rounded-lg transition-colors flex-shrink-0"
                title={t('modal.back')}
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                {t('telegramBot.admin.title')}
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {currentUser && (
                <UserProfileMenu 
                  currentUser={currentUser} 
                  onLogout={onLogout}
                  onOpenSettings={onOpenSettings}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="bg-yt-light rounded-lg p-4 sm:p-6 shadow-xl">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-yt-dark p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Bot className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">{t('telegramBot.admin.totalBots')}</p>
                  <p className="text-2xl font-bold">{bots.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-yt-dark p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-400">{t('telegramBot.admin.runningBots')}</p>
                  <p className="text-2xl font-bold">
                    {bots.filter(b => b.status === 'running').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-yt-dark p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-sm text-gray-400">{t('telegramBot.admin.errorBots')}</p>
                  <p className="text-2xl font-bold">
                    {bots.filter(b => b.status === 'error').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bots Table */}
          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-gray-400">{t('telegramBot.admin.loading')}</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-16">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">{t('telegramBot.admin.noBots')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                      {t('telegramBot.admin.user')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                      {t('telegramBot.admin.mode')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                      {t('telegramBot.admin.status')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">
                      {t('telegramBot.admin.lastActive')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400 whitespace-nowrap">
                      {t('telegramBot.admin.downloads')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                      {t('telegramBot.admin.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((bot) => (
                    <tr key={bot.id} className="border-b border-gray-800 hover:bg-yt-dark transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{bot.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm whitespace-nowrap">
                          {getModeText(bot.bot_mode)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {getStatusIcon(bot.status)}
                          <span className="text-sm">{getStatusText(bot.status)}</span>
                        </div>
                        {bot.error_message && (
                          <p className="text-xs text-red-400 mt-1">{bot.error_message}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-400 whitespace-nowrap">
                        {formatDate(bot.last_active_at)}
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {bot.total_downloads || 0}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {bot.status === 'running' && (
                          <button
                            onClick={() => showStopConfirm(bot.user_id, bot.username)}
                            disabled={stoppingBotId === bot.user_id}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors inline-flex items-center gap-2"
                          >
                            <Square className="w-4 h-4" />
                            {stoppingBotId === bot.user_id ? t('telegramBot.admin.stopping') : t('telegramBot.admin.stop')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-yt-dark rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{t('telegramBot.admin.confirmStopTitle')}</h3>
            <p className="text-gray-300 mb-6">
              {t('telegramBot.admin.confirmStop', { username: confirmModal.username })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ show: false, userId: null, username: '' })}
                className="px-4 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={handleStopBot}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {t('modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
