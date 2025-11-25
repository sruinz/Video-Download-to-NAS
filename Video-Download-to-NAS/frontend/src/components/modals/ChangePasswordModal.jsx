import React, { useState } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateCurrentUser } from '../../api';
import showToast from '../../utils/toast';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validatePassword = (password) => {
    if (password.length < 6) {
      return t('changePassword.errors.minLength');
    }
    return null;
  };

  const handleNewPasswordChange = (value) => {
    setNewPassword(value);
    const error = validatePassword(value);
    setErrors(prev => ({ ...prev, newPassword: error }));
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

    // Validate all fields
    const newPasswordError = validatePassword(newPassword);
    if (newPasswordError) {
      setErrors(prev => ({ ...prev, newPassword: newPasswordError }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: t('changePassword.errors.notMatch') }));
      return;
    }

    try {
      setLoading(true);
      await updateCurrentUser({
        current_password: currentPassword,
        new_password: newPassword
      });
      showToast.success(t('changePassword.success'));
      onClose();
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (error) {
      const errorMessage = error.response?.data?.detail || t('changePassword.failed');
      if (errorMessage.includes('Current password')) {
        setErrors(prev => ({ ...prev, currentPassword: t('changePassword.errors.wrongCurrent') }));
      } else {
        showToast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('changePassword.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('changePassword.currentPassword')} *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setErrors(prev => ({ ...prev, currentPassword: null }));
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                errors.currentPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('changePassword.currentPasswordPlaceholder')}
              required
            />
            {errors.currentPassword && (
              <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.currentPassword}</span>
              </div>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('changePassword.newPassword')} *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                errors.newPassword ? 'border-red-500' : newPassword.length >= 6 ? 'border-green-500' : 'border-gray-300'
              }`}
              placeholder={t('changePassword.newPasswordPlaceholder')}
              required
            />
            {errors.newPassword ? (
              <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.newPassword}</span>
              </div>
            ) : newPassword.length >= 6 ? (
              <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
                <Check className="w-4 h-4" />
                <span>{t('changePassword.errors.validPassword')}</span>
              </div>
            ) : null}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('changePassword.confirmPassword')} *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                errors.confirmPassword ? 'border-red-500' : confirmPassword && newPassword === confirmPassword ? 'border-green-500' : 'border-gray-300'
              }`}
              placeholder={t('changePassword.confirmPasswordPlaceholder')}
              required
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

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || Object.values(errors).some(e => e) || !currentPassword || !newPassword || !confirmPassword}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('changePassword.submitting') : t('changePassword.submit')}
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
