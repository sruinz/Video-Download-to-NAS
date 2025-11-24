import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Key, Plus } from 'lucide-react';
import { getAllUsers, createUser, updateUserPermissions, adminChangePassword } from '../../api';
import showToast from '../../utils/toast';

export default function UserManagementModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(null);

  const permissions = [
    { key: 'can_download_to_nas', label: 'NAS 저장 권한' },
    { key: 'can_download_from_nas', label: 'PC 다운로드 권한' },
    { key: 'can_create_share_links', label: '공유 링크 생성 권한' },
    { key: 'can_view_public_board', label: '공개 게시판 조회 권한' },
    { key: 'can_post_to_public_board', label: '공개 게시판 게시 권한' }
  ];

  const roles = [
    { value: 'super_admin', label: '슈퍼 관리자' },
    { value: 'admin', label: '관리자' },
    { value: 'user', label: '사용자' },
    { value: 'guest', label: '게스트' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      showToast.error('사용자 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      showToast.success('사용자가 생성되었습니다');
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      setShowCreateForm(false);
      loadUsers();
    } catch (error) {
      showToast.error(error.message);
    }
  };

  const handleUpdatePermissions = async (userId, permissionKey, value) => {
    try {
      const user = users.find(u => u.id === userId);
      const updatedPermissions = {
        ...user.permissions,
        [permissionKey]: value
      };
      await updateUserPermissions(userId, updatedPermissions);
      showToast.success('권한이 업데이트되었습니다');
      loadUsers();
    } catch (error) {
      showToast.error('권한 업데이트에 실패했습니다');
    }
  };

  const handleChangePassword = async (userId) => {
    if (!newPassword.trim()) {
      showToast.error('새 비밀번호를 입력하세요');
      return;
    }
    
    try {
      await adminChangePassword(userId, newPassword);
      showToast.success('비밀번호가 변경되었습니다');
      setNewPassword('');
      setShowPasswordForm(null);
    } catch (error) {
      showToast.error('비밀번호 변경에 실패했습니다');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">사용자 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Create User Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 사용자 생성
            </button>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">새 사용자 생성</h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">사용자명</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">비밀번호</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">역할</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    생성
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">사용자 목록을 불러오는 중...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{user.username}</h3>
                      <p className="text-sm text-gray-600">
                        {user.email} • {roles.find(r => r.value === user.role)?.label} • 
                        {user.is_active ? ' 활성' : ' 비활성'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="권한 편집"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowPasswordForm(showPasswordForm === user.id ? null : user.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="비밀번호 변경"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Password Change Form */}
                  {showPasswordForm === user.id && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium mb-2 text-gray-900">비밀번호 변경</h4>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="새 비밀번호"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        />
                        <button
                          onClick={() => handleChangePassword(user.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          변경
                        </button>
                        <button
                          onClick={() => {
                            setShowPasswordForm(null);
                            setNewPassword('');
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Permissions */}
                  {editingUser === user.id && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium mb-3 text-gray-900">권한 설정</h4>
                      <div className="space-y-3">
                        {permissions.map(permission => {
                          // Use raw permission value (0=role default, 1=allowed, 2=denied)
                          const rawValue = user.permission_values?.[permission.key] ?? 0;
                          const effectivePermission = user.permissions[permission.key];
                          
                          return (
                            <div key={permission.key} className="flex items-center justify-between p-2 bg-white rounded">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-700">{permission.label}</span>
                                <div className="text-xs text-gray-500 mt-1">
                                  현재: {effectivePermission ? '허용됨' : '거부됨'}
                                  {rawValue === 0 && ' (역할 기본값)'}
                                </div>
                              </div>
                              <select
                                value={rawValue}
                                onChange={(e) => handleUpdatePermissions(user.id, permission.key, parseInt(e.target.value))}
                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              >
                                <option value="0">역할 기본값</option>
                                <option value="1">허용</option>
                                <option value="2">거부</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
