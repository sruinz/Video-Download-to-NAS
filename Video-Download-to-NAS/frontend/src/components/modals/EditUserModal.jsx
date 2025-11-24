import React, { useState, useEffect } from 'react';
import { X, User, Mail, Key, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminUpdateUser, adminChangePassword } from '../../api';
import showToast from '../../utils/toast';

export default function EditUserModal({ isOpen, onClose, user, onUserUpdated }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setDisplayName(user.display_name || '');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  }, [user]);

  const validateEmail = (email) => {
    if (!email) {
      return t('settings.users.errors.emailRequired');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return t('settings.users.errors.invalidEmail');
    }
    return null;
  };

  const validatePassword = (password) => {
    if (password && password.length < 6) {
      return t('changePassword.errors.minLength');
    }
    return null;
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    const error = validateEmail(value);
    setErrors(prev => ({ ...prev, email: error }));
  };

  const handlePasswordChange = (value) => {
    setNewPassword(value);
    if (value) {
      const error = validatePassword(value);
      setErrors(prev => ({ ...prev, newPassword: error }));
    } else {
      setErrors(prev => ({ ...prev, newPassword: null }));
    }
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    if (value && newPassword && value !== newPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: t('changePassword.errors.notMatch') }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors(prev => ({ ...prev, email: emailError }));
      return;
    }

    // Validate password if provided
    if (newPassword) {
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        setErrors(prev => ({ ...prev, newPassword: passwordError }));
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrors(prev => ({ ...prev, confirmPassword: t('changePassword.errors.notMatch') }));
        return;
      }
    }

    try {
      setLoading(true);

      // Update user info (email and display_name)
      await adminUpdateUser(user.id, {
        email: email,
        display_name: displayName || null
      });

      // Update password if provided
      if (newPassword) {
        await adminChangePassword(user.id, newPassword);
      }

      showToast.success(t('settings.users.updateSuccess'));
      onUserUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update user:', error);
      showToast.error(t('settings.users.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('settings.users.editUser')}</h2>
              <p className="text-sm text-gray-600">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              {t('settings.users.email')} *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('settings.users.emailPlaceholder')}
              required
            />
            {errors.email && (
              <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.email}</span>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              {t('settings.users.displayName')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder={t('settings.users.displayNamePlaceholder')}
            />
            <p className="text-xs text-gray-500 mt-1">{t('settings.users.displayNameHint')}</p>
          </div>

          {/* Password Section */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-gray-700 mb-3">
              <Key className="w-4 h-4 inline mr-1" />
              {t('settings.users.changePassword')}
            </p>
            <p className="text-xs text-gray-500 mb-3">{t('settings.users.passwordOptional')}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('changePassword.newPassword')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    errors.newPassword ? 'border-red-500' : newPassword && newPassword.length >= 6 ? 'border-green-500' : 'border-gray-300'
                  }`}
                  placeholder={t('changePassword.newPasswordPlaceholder')}
                />
                {errors.newPassword ? (
                  <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.newPassword}</span>
                  </div>
                ) : newPassword && newPassword.length >= 6 ? (
                  <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    <span>{t('changePassword.errors.validPassword')}</span>
                  </div>
                ) : null}
              </div>

              {newPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('changePassword.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                      errors.confirmPassword ? 'border-red-500' : confirmPassword && newPassword === confirmPassword ? 'border-green-500' : 'border-gray-300'
                    }`}
                    placeholder={t('changePassword.confirmPasswordPlaceholder')}
                  />
                  {errors.confirmPassword ? (
                    <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.confirmPassword}</span>
                    </div>
                  ) : confirmPassword && newPassword === confirmPassword ? (
                    <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      <span>{t('changePassword.errors.passwordsMatch')}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || Object.values(errors).some(e => e)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('settings.users.updating') : t('settings.users.update')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('modal.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
