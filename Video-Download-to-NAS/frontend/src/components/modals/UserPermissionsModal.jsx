import React, { useState, useEffect } from 'react';
import { X, Shield, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateUserPermissions } from '../../api';
import showToast from '../../utils/toast';

export default function UserPermissionsModal({ isOpen, onClose, user, onUpdate }) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);

  // Update permissions when user changes
  useEffect(() => {
    if (user?.permission_values) {
      // Use permission_values (0=default, 1=allow, 2=deny)
      setPermissions({
        can_download_to_nas: user.permission_values.can_download_to_nas ?? 0,
        can_download_from_nas: user.permission_values.can_download_from_nas ?? 0,
        can_create_share_links: user.permission_values.can_create_share_links ?? 0,
        can_view_public_board: user.permission_values.can_view_public_board ?? 0,
        can_post_to_public_board: user.permission_values.can_post_to_public_board ?? 0,
        can_use_telegram_bot: user.permission_values.can_use_telegram_bot ?? 0
      });
    }
  }, [user]);

  const getPermissionLabel = (key) => {
    const labels = {
      can_download_to_nas: t('permissions.canDownloadToNas'),
      can_download_from_nas: t('permissions.canDownload'),
      can_create_share_links: t('permissions.canCreateShareLinks'),
      can_view_public_board: t('permissions.canViewPublicBoard'),
      can_post_to_public_board: t('permissions.canPostToPublicBoard'),
      can_use_telegram_bot: t('permissions.canUseTelegramBot')
    };
    return labels[key] || key;
  };

  const getRoleDefault = (key) => {
    if (!user?.role_defaults) return false;
    return user.role_defaults[key] === 1;
  };

  const getPermissionStateLabel = (value) => {
    if (value === 0) return t('permissions.useDefault');
    if (value === 1) return t('permissions.allow');
    if (value === 2) return t('permissions.deny');
    return '';
  };

  const getPermissionStateColor = (value, roleDefault) => {
    if (value === 0) {
      // Using default - show what the default is
      return roleDefault ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-600 bg-gray-50 border-gray-200';
    }
    if (value === 1) return 'text-green-600 bg-green-50 border-green-200';
    if (value === 2) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const cyclePermission = (key) => {
    setPermissions(prev => {
      const current = prev[key];
      // Cycle: 0 (default) -> 1 (allow) -> 2 (deny) -> 0 (default)
      const next = (current + 1) % 3;
      return {
        ...prev,
        [key]: next
      };
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateUserPermissions(user.id, permissions);
      showToast.success(t('permissions.success'));
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      showToast.error(t('permissions.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('permissions.title')}</h2>
              <p className="text-sm text-gray-600">{user.username} ({user.role})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">{t('permissions.threeStateInfo')}</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><span className="font-medium">{t('permissions.useDefault')}:</span> {t('permissions.useDefaultDesc')}</li>
                  <li><span className="font-medium">{t('permissions.allow')}:</span> {t('permissions.allowDesc')}</li>
                  <li><span className="font-medium">{t('permissions.deny')}:</span> {t('permissions.denyDesc')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Permissions List */}
          <div className="space-y-3">
            {Object.keys(permissions).map(key => {
              const value = permissions[key];
              const roleDefault = getRoleDefault(key);
              
              return (
                <div key={key} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {getPermissionLabel(key)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t('permissions.roleDefault')}: {roleDefault ? 
                          <span className="text-green-600 font-medium">✓ {t('permissions.allowed')}</span> : 
                          <span className="text-red-600 font-medium">✗ {t('permissions.denied')}</span>
                        }
                      </div>
                    </div>
                    
                    <button
                      onClick={() => cyclePermission(key)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all hover:shadow-md ${getPermissionStateColor(value, roleDefault)}`}
                    >
                      {getPermissionStateLabel(value)}
                      {value === 0 && (
                        <span className="ml-1">
                          ({roleDefault ? '✓' : '✗'})
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? t('permissions.saving') : t('permissions.save')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              {t('modal.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
