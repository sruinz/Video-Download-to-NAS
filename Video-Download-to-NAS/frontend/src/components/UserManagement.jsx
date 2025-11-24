import React, { useState, useEffect } from 'react';
import { Trash2, Shield, HardDrive, Edit, Check, X } from 'lucide-react';
import { listUsers, updateUserRole, updateUserQuota, updateUserRateLimit, deleteUser, getAllUsers, approveUser, rejectUser } from '../api';
import showToast from '../utils/toast';
import { useModal } from '../contexts/ModalContext';
import { useTranslation } from 'react-i18next';
import UserPermissionsModal from './modals/UserPermissionsModal';
import EditUserModal from './modals/EditUserModal';

export default function UserManagement({ initialFilter = 'all' }) {
  const { t } = useTranslation();
  const { showInputModal, showConfirmModal } = useModal();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userFilter, setUserFilter] = useState(initialFilter); // 'all', 'active', 'pending'

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      console.log('Loaded users:', data);
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      showToast.error('Failed to load users: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionsClick = (user) => {
    setSelectedUser(user);
    setShowPermissionsModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      showToast.success('User role updated');
      loadUsers();
    } catch (error) {
      showToast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleQuotaChange = async (userId, currentQuota, username) => {
    try {
      const newQuota = await showInputModal({
        title: `Update Quota for ${username}`,
        label: 'Enter new storage quota:',
        defaultValue: currentQuota,
        type: 'number',
        min: 1,
        max: 10000,
        unit: 'GB'
      });
      
      const quota = parseInt(newQuota);
      await updateUserQuota(userId, quota);
      showToast.success('Storage quota updated');
      loadUsers();
    } catch (error) {
      if (error) {
        showToast.error('Failed to update quota');
      }
    }
  };

  const handleRateLimitChange = async (userId, currentLimit, username, role) => {
    try {
      const newLimit = await showInputModal({
        title: `Update Rate Limit for ${username}`,
        label: 'Enter custom rate limit (leave empty for role default):',
        defaultValue: currentLimit || '',
        placeholder: 'Use role default',
        type: 'number',
        min: 0,
        max: 10000,
        unit: '/ min'
      });
      
      const limit = newLimit.trim() === '' ? null : parseInt(newLimit);
      await updateUserRateLimit(userId, limit);
      showToast.success(limit === null ? 'Using role default' : 'Custom rate limit set');
      loadUsers();
    } catch (error) {
      if (error) {
        showToast.error('Failed to update rate limit');
      }
    }
  };

  const handleDeleteUser = async (userId, username, role) => {
    try {
      // Check if it's the last super_admin
      const isSuperAdmin = role === 'super_admin';
      const superAdminCount = users.filter(u => u.role === 'super_admin').length;
      
      const confirmed = await showConfirmModal({
        title: t('deleteUser.title'),
        message: `${t('deleteUser.message', { username })}\n\n${t('deleteUser.warning')}\n• ${t('deleteUser.items.account')}\n• ${t('deleteUser.items.files')}\n• ${t('deleteUser.items.settings')}\n\n${t('deleteUser.cannotUndo')}`,
        confirmText: t('modal.delete'),
        cancelText: t('modal.cancel'),
        danger: true,
        requireTyping: isSuperAdmin && superAdminCount <= 1 ? undefined : 'DELETE',
        requireTypingLabel: t('deleteUser.typeToConfirm')
      });

      if (!confirmed) return;

      await deleteUser(userId);
      showToast.success(t('deleteUser.deleteButton'));
      loadUsers();
    } catch (error) {
      if (error?.response?.data?.detail) {
        showToast.error(error.response.data.detail);
      } else if (error) {
        showToast.error(t('deleteUser.failed'));
      }
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      await approveUser(userId);
      showToast.success(t('users.approveSuccess'));
      loadUsers();
    } catch (error) {
      showToast.error(error.message || t('users.approveFailed'));
    }
  };

  const handleRejectUser = async (userId, username) => {
    try {
      const confirmed = await showConfirmModal({
        title: t('users.rejectTitle'),
        message: t('users.confirmReject', { username }),
        confirmText: t('users.reject'),
        cancelText: t('modal.cancel'),
        danger: true
      });

      if (!confirmed) return;

      await rejectUser(userId);
      showToast.success(t('users.rejectSuccess'));
      loadUsers();
    } catch (error) {
      showToast.error(error.message || t('users.rejectFailed'));
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin': return 'bg-red-900 text-red-200';
      case 'admin': return 'bg-purple-900 text-purple-200';
      case 'user': return 'bg-blue-900 text-blue-200';
      case 'guest': return 'bg-gray-700 text-gray-300';
      default: return 'bg-gray-700 text-gray-300';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  // Filter users based on selected filter
  const filteredUsers = users.filter(user => {
    if (userFilter === 'pending') return user.is_active === 0 || user.is_active === false;
    if (userFilter === 'active') return user.is_active === 1 || user.is_active === true;
    return true; // 'all'
  });

  return (
    <div className="bg-yt-light rounded-lg overflow-hidden">
      {/* Filter Buttons */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => setUserFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userFilter === 'all'
                ? 'bg-yt-red text-white'
                : 'bg-yt-dark text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t('users.all')}
          </button>
          <button
            onClick={() => setUserFilter('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userFilter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-yt-dark text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t('users.active')}
          </button>
          <button
            onClick={() => setUserFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userFilter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-yt-dark text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t('users.pending')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-yt-dark">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Quota
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Rate Limit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-yt-dark transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-yt-red rounded-full flex items-center justify-center text-white font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-white">{user.username}</div>
                      <div className="text-xs text-gray-400">ID: {user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className={`px-3 py-1 rounded text-xs font-medium ${getRoleBadgeColor(user.role)} border-none focus:outline-none focus:ring-2 focus:ring-yt-red`}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="guest">Guest</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleQuotaChange(user.id, user.storage_quota_gb, user.username)}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    <HardDrive className="w-4 h-4" />
                    {user.storage_quota_gb} GB
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleRateLimitChange(user.id, user.custom_rate_limit, user.username, user.role)}
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                    title={user.custom_rate_limit ? 'Custom limit' : 'Using role default'}
                  >
                    {user.custom_rate_limit !== null ? (
                      <span className="text-yellow-400">{user.custom_rate_limit}/min ⚡</span>
                    ) : (
                      <span className="text-gray-500">Role default</span>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {(user.is_active === 0 || user.is_active === false) ? (
                      // Approval/Rejection buttons for pending users
                      <>
                        <button
                          onClick={() => handleApproveUser(user.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1 transition-colors"
                          title={t('users.approve')}
                        >
                          <Check className="w-4 h-4" />
                          {t('users.approve')}
                        </button>
                        <button
                          onClick={() => handleRejectUser(user.id, user.username)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1 transition-colors"
                          title={t('users.reject')}
                        >
                          <X className="w-4 h-4" />
                          {t('users.reject')}
                        </button>
                      </>
                    ) : (
                      // Regular action buttons for active users
                      <>
                        <button
                          onClick={() => handlePermissionsClick(user)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title="Manage permissions"
                        >
                          <Shield className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-green-400 hover:text-green-300 transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username, user.role)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title={t('deleteUser.deleteButton')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permissions Modal */}
      <UserPermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUpdate={loadUsers}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUserUpdated={loadUsers}
      />
    </div>
  );
}
