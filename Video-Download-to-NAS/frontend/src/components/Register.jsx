import React, { useState } from 'react';
import { Video, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import showToast from '../utils/toast';

export default function Register({ onRegister, onBackToLogin }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast.error(t('auth.passwordsNotMatch'));
      return;
    }

    if (password.length < 8) {
      showToast.error(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      const user = await onRegister({ username, email: email || null, password });
      
      // is_active 값에 따라 다른 메시지 표시
      // is_active는 boolean 또는 0/1로 올 수 있음
      if (user.is_active === false || user.is_active === 0) {
        showToast.success(t('auth.registrationPendingApproval'));
      } else {
        showToast.success(t('auth.registrationSuccess'));
      }
      
      onBackToLogin();
    } catch (err) {
      showToast.error(err.response?.data?.detail || t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-yt-darker">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="bg-yt-light p-8 rounded-lg shadow-2xl w-full max-w-md">
        <button
          onClick={onBackToLogin}
          className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('auth.backToLogin')}
        </button>

        <div className="flex items-center justify-center mb-8">
          <Video className="w-12 h-12 text-yt-red mr-3" />
          <h1 className="text-3xl font-bold text-white">{t('auth.register')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.username')} *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.enterUsername')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.emailOptional')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.enterEmail')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.password')} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.passwordMinLength')}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.confirmPassword')} *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.confirmPasswordPlaceholder')}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.creatingAccount') : t('auth.register')}
          </button>
        </form>
      </div>
    </div>
  );
}
