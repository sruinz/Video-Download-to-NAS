import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, Save, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAllRolePermissions, updateRolePermissions } from '../api';
import showToast from '../utils/toast';
import UserProfileMenu from '../components/UserProfileMenu';

export default function RolePermissionsManagement({ onClose, currentUser, onLogout, onOpenSettings }) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await getAllRolePermissions();
      setPermissions(data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      showToast.error(t('rolePermissions.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (role, permission, value) => {
    setPermissions(prev => prev.map(p => 
      p.role === role 
        ? { ...p, [permission]: value }
        : p
    ));
  };

  const handleSave = async (role) => {
    if (role === 'super_admin') {
      showToast.error(t('rolePermissions.cannotModifySuperAdmin'));
      return;
    }

    try {
      setSaving(role);
      const rolePerms = permissions.find(p => p.role === role);
      
      await updateRolePermissions(role, {
        can_download_to_nas: rolePerms.can_download_to_nas,
        can_download_from_nas: rolePerms.can_download_from_nas,
        can_create_share_links: rolePerms.can_create_share_links,
        can_view_public_board: rolePerms.can_view_public_board,
        can_post_to_public_board: rolePerms.can_post_to_public_board,
        can_use_telegram_bot: rolePerms.can_use_telegram_bot
      });
      
      showToast.success(t('rolePermissions.saveSuccess'));
    } catch (error) {
      console.error('Failed to save permissions:', error);
      showToast.error(t('rolePermissions.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  const getRoleName = (role) => {
    const roleNames = {
      'super_admin': t('rolePermissions.roles.superAdmin'),
      'admin': t('rolePermissions.roles.admin'),
      'user': t('rolePermissions.roles.user'),
      'guest': t('rolePermissions.roles.guest')
    };
    return roleNames[role] || role;
  };

  const getPermissionName = (permission) => {
    const permNames = {
      'can_download_to_nas': t('rolePermissions.permissions.downloadToNas'),
      'can_download_from_nas': t('rolePermissions.permissions.downloadFromNas'),
      'can_create_share_links': t('rolePermissions.permissions.createShareLinks'),
      'can_view_public_board': t('rolePermissions.permissions.viewPublicBoard'),
      'can_post_to_public_board': t('rolePermissions.permissions.postToPublicBoard'),
      'can_use_telegram_bot': t('rolePermissions.permissions.useTelegramBot')
    };
    return permNames[permission] || permission;
  };

  const permissionKeys = [
    'can_download_to_nas',
    'can_download_from_nas',
    'can_create_share_links',
    'can_view_public_board',
    'can_post_to_public_board',
    'can_use_telegram_bot'
  ];

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
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                {t('rolePermissions.title')}
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
          <p className="text-gray-400 mb-6">
            {t('rolePermissions.description')}
          </p>

          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-gray-400">{t('rolePermissions.loading')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {permissions.map((rolePerms) => (
                <div key={rolePerms.role} className="bg-yt-dark rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{getRoleName(rolePerms.role)}</h2>
                    {rolePerms.role !== 'super_admin' && (
                      <button
                        onClick={() => handleSave(rolePerms.role)}
                        disabled={saving === rolePerms.role}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {saving === rolePerms.role ? t('rolePermissions.saving') : t('rolePermissions.save')}
                      </button>
                    )}
                  </div>

                  {rolePerms.role === 'super_admin' && (
                    <p className="text-sm text-gray-400 mb-4">
                      {t('rolePermissions.superAdminNote')}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {permissionKeys.map((permKey) => (
                      <div key={permKey} className="flex items-center justify-between p-3 bg-yt-light rounded-lg">
                        <span className="text-sm">{getPermissionName(permKey)}</span>
                        <button
                          onClick={() => handlePermissionChange(rolePerms.role, permKey, rolePerms[permKey] === 1 ? 0 : 1)}
                          disabled={rolePerms.role === 'super_admin'}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                            rolePerms[permKey] === 1
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-red-600 hover:bg-red-700'
                          } ${rolePerms.role === 'super_admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {rolePerms[permKey] === 1 ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm">{t('rolePermissions.enabled')}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span className="text-sm">{t('rolePermissions.disabled')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
