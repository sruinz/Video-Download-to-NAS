import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, HardDrive, Activity, RefreshCw, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSettings, updateSettings, getSystemStats, listUsers, syncLibrary, getAllUsers } from '../api';
import showToast from '../utils/toast';
import UserManagement from '../components/UserManagement';
import UserProfileMenu from '../components/UserProfileMenu';
import LibrarySyncModal from '../components/modals/LibrarySyncModal';
import SSOSettings from './SSOSettings';
import { useModal } from '../contexts/ModalContext';

export default function Settings({ onBack, currentUser, onLogout, onOpenShareLinks, onOpenSSOGuide, onOpenTelegramBotManagement, onOpenRolePermissions, initialTab = 'overview', initialUserFilter = 'all' }) {
  const { t } = useTranslation();
  const { showInputModal, showConfirmModal } = useModal();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState([]);
  const [showSyncModal, setShowSyncModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Only super_admin can access system settings
      if (currentUser.role === 'super_admin') {
        const [settingsData, statsData, usersData] = await Promise.all([
          getSettings(),
          getSystemStats(),
          getAllUsers()
        ]);
        setSettings(settingsData);
        setStats(statsData);
        setUsers(usersData);
      } else {
        // Admin can only access stats
        const statsData = await getSystemStats();
        setStats(statsData);
        setSettings(null);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast.error(t('settings.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLibrarySyncConfirm = async (selectedUserId) => {
    try {
      setSyncing(true);
      const toastId = showToast.loading(t('settings.librarySync.syncing'));

      const result = await syncLibrary(selectedUserId);

      showToast.dismiss(toastId);
      
      // Show results
      const resultsMessage = `${t('settings.librarySync.results.title')}:\n\n` +
        `${t('settings.librarySync.results.scannedFiles')}: ${result.results.scanned}\n` +
        `${t('settings.librarySync.results.addedFiles')}: ${result.results.added}\n` +
        `${t('settings.librarySync.results.skippedFiles')}: ${result.results.skipped}\n` +
        `${t('settings.librarySync.results.errors')}: ${result.results.errors}`;

      showToast.success(resultsMessage, { duration: 8000 });

    } catch (error) {
      showToast.error(t('settings.librarySync.failed') + ': ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yt-darker flex items-center justify-center">
        <div className="text-white">{t('settings.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yt-darker">
      {/* Header */}
      <header className="bg-yt-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SettingsIcon className="w-8 h-8 text-yt-red flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold text-white whitespace-nowrap">{t('settings.title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('settings.backButton')}
              </button>
              <UserProfileMenu 
                currentUser={currentUser} 
                onLogout={onLogout}
                onOpenShareLinks={onOpenShareLinks}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-yt-red border-b-2 border-yt-red'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t('settings.tabs.overview')}
          </button>
          {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('settings.tabs.users')}
            </button>
          )}
          {currentUser.role === 'super_admin' && (
            <button
              onClick={() => setActiveTab('sso')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'sso'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('settings.tabs.sso')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-yt-light p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-blue-500" />
                  <span className="text-3xl font-bold">{stats.total_users}</span>
                </div>
                <p className="text-gray-400">{t('settings.stats.totalUsers')}</p>
              </div>

              <div className="bg-yt-light p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <HardDrive className="w-8 h-8 text-green-500" />
                  <span className="text-3xl font-bold">{stats.total_files}</span>
                </div>
                <p className="text-gray-400">{t('settings.stats.totalFiles')}</p>
              </div>

              <div className="bg-yt-light p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <HardDrive className="w-8 h-8 text-purple-500" />
                  <span className="text-3xl font-bold">{stats.total_storage_used_gb} GB</span>
                </div>
                <p className="text-gray-400">{t('settings.stats.storageUsed')}</p>
              </div>

              <div className="bg-yt-light p-6 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-8 h-8 text-yellow-500" />
                  <span className="text-3xl font-bold">{stats.active_downloads}</span>
                </div>
                <p className="text-gray-400">{t('settings.stats.activeDownloads')}</p>
              </div>
            </div>

            {/* System Settings - Super Admin Only */}
            {currentUser.role === 'super_admin' && settings && (
              <div className="bg-yt-light p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">{t('settings.system.title')}</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">{t('settings.system.registrationEnabled')}</span>
                    <button
                      onClick={async () => {
                        try {
                          const updated = await updateSettings({ allow_registration: !settings.allow_registration });
                          setSettings(updated);
                          showToast.success(t(updated.allow_registration ? 'settings.messages.registrationEnabled' : 'settings.messages.registrationDisabled'));
                        } catch (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        settings.allow_registration 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {t(settings.allow_registration ? 'settings.system.on' : 'settings.system.off')}
                    </button>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <div>
                      <span className="text-gray-300">{t('settings.system.localLoginEnabled')}</span>
                      <p className="text-xs text-gray-500 mt-1">{t('settings.system.localLoginHint')}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const updated = await updateSettings({ local_login_enabled: !settings.local_login_enabled });
                          setSettings(updated);
                          showToast.success(t(updated.local_login_enabled ? 'settings.messages.localLoginEnabled' : 'settings.messages.localLoginDisabled'));
                        } catch (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        settings.local_login_enabled 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {t(settings.local_login_enabled ? 'settings.system.on' : 'settings.system.off')}
                    </button>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <div>
                      <span className="text-gray-300">{t('settings.system.requireApproval')}</span>
                      <p className="text-xs text-gray-500 mt-1">{t('settings.system.requireApprovalHint')}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const updated = await updateSettings({ require_admin_approval: !settings.require_admin_approval });
                          setSettings(updated);
                          showToast.success(t(updated.require_admin_approval ? 'settings.messages.approvalEnabled' : 'settings.messages.approvalDisabled'));
                        } catch (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }}
                      className={`px-4 py-2 rounded font-medium transition-colors ${
                        settings.require_admin_approval
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {t(settings.require_admin_approval ? 'settings.system.on' : 'settings.system.off')}
                    </button>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">{t('settings.system.defaultUserRole')}</span>
                    <select
                      value={settings.default_user_role}
                      onChange={async (e) => {
                        try {
                          const updated = await updateSettings({ default_user_role: e.target.value });
                          setSettings(updated);
                          showToast.success(t('settings.messages.defaultRoleUpdated'));
                        } catch (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }}
                      className="px-3 py-1 bg-yt-dark border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
                    >
                      <option value="user">{t('settings.system.user')}</option>
                      <option value="guest">{t('settings.system.guest')}</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">{t('settings.system.defaultUserQuota')}</span>
                    <button
                      onClick={async () => {
                        try {
                          const newQuota = await showInputModal({
                            title: t('settings.system.defaultUserQuota'),
                            label: t('settings.prompts.enterUserQuota'),
                            defaultValue: settings.default_user_quota_gb,
                            type: 'number',
                            min: 1,
                            max: 10000,
                            unit: 'GB'
                          });
                          
                          const quota = parseInt(newQuota);
                        const updated = await updateSettings({ default_user_quota_gb: quota });
                        setSettings(updated);
                        showToast.success(t('settings.messages.quotaUpdated'));
                      } catch (error) {
                        // User cancelled or error occurred
                        if (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }
                    }}
                    className="text-white font-medium hover:text-yt-red transition-colors"
                  >
                    {settings.default_user_quota_gb} GB ✏️
                  </button>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-300">{t('settings.system.adminQuota')}</span>
                  <button
                    onClick={async () => {
                      try {
                        const newQuota = await showInputModal({
                          title: t('settings.system.adminQuota'),
                          label: t('settings.prompts.enterAdminQuota'),
                          defaultValue: settings.admin_quota_gb,
                          type: 'number',
                          min: 1,
                          max: 10000,
                          unit: 'GB'
                        });
                        
                        const quota = parseInt(newQuota);
                        const updated = await updateSettings({ admin_quota_gb: quota });
                        setSettings(updated);
                        showToast.success(t('settings.messages.quotaUpdated'));
                      } catch (error) {
                        if (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }
                    }}
                    className="text-white font-medium hover:text-yt-red transition-colors"
                  >
                    {settings.admin_quota_gb} GB ✏️
                  </button>
                </div>
                
                {/* Display Name Change Cooldown */}
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <div>
                    <span className="text-gray-300">{t('settings.system.displayNameCooldown')}</span>
                    <p className="text-xs text-gray-500 mt-1">{t('settings.system.displayNameCooldownHint')}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const newDays = await showInputModal({
                          title: t('settings.system.displayNameCooldown'),
                          label: t('settings.prompts.enterCooldownDays'),
                          defaultValue: settings.display_name_change_cooldown_days || 30,
                          type: 'number',
                          min: 0,
                          max: 365,
                          unit: t('settings.system.days')
                        });
                        
                        const days = parseInt(newDays);
                        const updated = await updateSettings({ display_name_change_cooldown_days: days });
                        setSettings(updated);
                        showToast.success(t('settings.messages.cooldownUpdated'));
                      } catch (error) {
                        if (error) {
                          showToast.error(t('settings.messages.updateFailed'));
                        }
                      }
                    }}
                    className="text-white font-medium hover:text-yt-red transition-colors"
                  >
                    {settings.display_name_change_cooldown_days || 30} {t('settings.system.days')} ✏️
                  </button>
                </div>
                
                {/* Rate Limits by Role */}
                <div className="py-2 border-b border-gray-700">
                  <h3 className="text-gray-300 font-medium mb-3">Rate Limits (per minute)</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Super Admin</span>
                      <button
                        onClick={async () => {
                          try {
                            const newLimit = await showInputModal({
                              title: 'Super Admin Rate Limit',
                              label: 'Enter rate limit (0 = unlimited):',
                              defaultValue: settings.rate_limit_super_admin,
                              type: 'number',
                              min: 0,
                              max: 10000,
                              unit: '/ min'
                            });
                            
                            const limit = parseInt(newLimit);
                            const updated = await updateSettings({ rate_limit_super_admin: limit });
                            setSettings(updated);
                            showToast.success('Rate limit updated');
                          } catch (error) {
                            if (error) showToast.error(t('settings.messages.updateFailed'));
                          }
                        }}
                        className="text-white text-sm hover:text-yt-red transition-colors"
                      >
                        {settings.rate_limit_super_admin === 0 ? 'Unlimited' : `${settings.rate_limit_super_admin}/min`} ✏️
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Admin</span>
                      <button
                        onClick={async () => {
                          try {
                            const newLimit = await showInputModal({
                              title: 'Admin Rate Limit',
                              label: 'Enter rate limit:',
                              defaultValue: settings.rate_limit_admin,
                              type: 'number',
                              min: 1,
                              max: 10000,
                              unit: '/ min'
                            });
                            
                            const limit = parseInt(newLimit);
                            const updated = await updateSettings({ rate_limit_admin: limit });
                            setSettings(updated);
                            showToast.success('Rate limit updated');
                          } catch (error) {
                            if (error) showToast.error(t('settings.messages.updateFailed'));
                          }
                        }}
                        className="text-white text-sm hover:text-yt-red transition-colors"
                      >
                        {settings.rate_limit_admin}/min ✏️
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">User</span>
                      <button
                        onClick={async () => {
                          try {
                            const newLimit = await showInputModal({
                              title: 'User Rate Limit',
                              label: 'Enter rate limit:',
                              defaultValue: settings.rate_limit_user,
                              type: 'number',
                              min: 1,
                              max: 10000,
                              unit: '/ min'
                            });
                            
                            const limit = parseInt(newLimit);
                            const updated = await updateSettings({ rate_limit_user: limit });
                            setSettings(updated);
                            showToast.success('Rate limit updated');
                          } catch (error) {
                            if (error) showToast.error(t('settings.messages.updateFailed'));
                          }
                        }}
                        className="text-white text-sm hover:text-yt-red transition-colors"
                      >
                        {settings.rate_limit_user}/min ✏️
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Guest</span>
                      <button
                        onClick={async () => {
                          try {
                            const newLimit = await showInputModal({
                              title: 'Guest Rate Limit',
                              label: 'Enter rate limit:',
                              defaultValue: settings.rate_limit_guest,
                              type: 'number',
                              min: 1,
                              max: 10000,
                              unit: '/ min'
                            });
                            
                            const limit = parseInt(newLimit);
                            const updated = await updateSettings({ rate_limit_guest: limit });
                            setSettings(updated);
                            showToast.success('Rate limit updated');
                          } catch (error) {
                            if (error) showToast.error(t('settings.messages.updateFailed'));
                          }
                        }}
                        className="text-white text-sm hover:text-yt-red transition-colors"
                      >
                        {settings.rate_limit_guest}/min ✏️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
                
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-200">
                    💡 {t('settings.info.settingsSaved')}
                  </p>
                </div>
              </div>
            )}

            {/* Library Sync - Super Admin Only */}
            {currentUser.role === 'super_admin' && (
              <div className="bg-yt-light p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">{t('settings.librarySync.title')}</h2>
                <p className="text-gray-400 mb-4">{t('settings.librarySync.description')}</p>
                <button
                  onClick={() => setShowSyncModal(true)}
                  disabled={syncing}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                >
                  <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? t('settings.librarySync.syncing') : t('settings.librarySync.button')}
                </button>
              </div>
            )}

            {/* Telegram Bot Management - Super Admin Only */}
            {currentUser.role === 'super_admin' && onOpenTelegramBotManagement && (
              <div className="bg-yt-light p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">{t('telegramBot.admin.title')}</h2>
                <p className="text-gray-400 mb-4">{t('telegramBot.admin.description')}</p>
                <button
                  onClick={onOpenTelegramBotManagement}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <Shield className="w-5 h-5" />
                  {t('telegramBot.admin.manage')}
                </button>
              </div>
            )}

            {/* Role Permissions Management - Super Admin Only */}
            {currentUser.role === 'super_admin' && onOpenRolePermissions && (
              <div className="bg-yt-light p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-4">{t('rolePermissions.title')}</h2>
                <p className="text-gray-400 mb-4">{t('rolePermissions.settingsDescription')}</p>
                <button
                  onClick={onOpenRolePermissions}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <Shield className="w-5 h-5" />
                  {t('rolePermissions.manage')}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
          <UserManagement initialFilter={initialUserFilter} />
        )}

        {activeTab === 'sso' && currentUser.role === 'super_admin' && (
          <SSOSettings onOpenGuide={onOpenSSOGuide} />
        )}
      </main>

      {/* Library Sync Modal */}
      <LibrarySyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onConfirm={handleLibrarySyncConfirm}
        users={users}
      />
    </div>
  );
}
