import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import SSOButton from './SSOButton';
import showToast from '../utils/toast';
import { getEnabledSSOProviders } from '../api';

export default function Login({ onLogin, onShowRegister }) {
  const { t } = useTranslation();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoProviders, setSsoProviders] = useState([]);
  const [localLoginEnabled, setLocalLoginEnabled] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Map backend SSO error messages to translation keys
  const mapSSOErrorToTranslation = (errorMsg) => {
    const lowerError = errorMsg.toLowerCase();
    
    // Check for specific error codes first
    if (errorMsg === 'SSO_ACCOUNT_CREATED_PENDING_APPROVAL') {
      return t('auth.ssoAccountCreatedPendingApproval');
    } else if (errorMsg === 'SSO_ACCOUNT_PENDING_APPROVAL') {
      return t('auth.ssoAccountPendingApproval');
    }
    
    // Check for specific error patterns
    if (lowerError.includes('pending approval') || lowerError.includes('pending admin approval')) {
      return t('auth.ssoAccountPendingApproval');
    } else if (lowerError.includes('denied') || lowerError.includes('access_denied')) {
      return t('auth.sso.errors.accessDenied');
    } else if (lowerError.includes('state') || lowerError.includes('expired') || lowerError.includes('session expired')) {
      return t('auth.sso.errors.invalidState');
    } else if (lowerError.includes('email') && lowerError.includes('mismatch')) {
      return t('auth.sso.errors.emailMismatch');
    } else if (lowerError.includes('disabled') || lowerError.includes('registration')) {
      return t('auth.sso.errors.registrationDisabled');
    } else if (lowerError.includes('network') || lowerError.includes('connection')) {
      return t('auth.sso.errors.networkError');
    } else if (lowerError.includes('not configured') || lowerError.includes('not available') || lowerError.includes('not enabled')) {
      return t('auth.sso.errors.providerNotConfigured');
    } else if (lowerError.includes('authentication failed') || lowerError.includes('failed to authenticate')) {
      return t('auth.sso.authenticationFailed');
    } else if (lowerError.includes('did not return') || lowerError.includes('required user information')) {
      return t('auth.sso.errors.missingUserInfo');
    } else if (lowerError.includes('token exchange') || lowerError.includes('failed to exchange')) {
      return t('auth.sso.errors.tokenExchangeFailed');
    } else if (lowerError.includes('unexpected error') || lowerError.includes('try again')) {
      return t('auth.sso.errors.unexpectedError');
    }
    
    // If no pattern matches, return the original message
    // but try to make it more user-friendly
    return errorMsg || t('auth.sso.authenticationFailed');
  };

  useEffect(() => {
    // Check for SSO error in URL parameters
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('error');
    
    if (ssoError) {
      // Map backend error messages to translation keys
      const errorMsg = mapSSOErrorToTranslation(ssoError);
      setError(errorMsg);
      showToast.error(errorMsg);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Load enabled SSO providers and public settings
    const loadSSOProviders = async () => {
      try {
        const response = await getEnabledSSOProviders();
        // 응답에서 providers 배열 추출
        const providers = response.providers || [];
        setSsoProviders(providers);
      } catch (error) {
        console.error('Failed to load SSO providers:', error);
        // Don't show error to user, just continue without SSO options
      }
    };
    
    const loadPublicSettings = async () => {
      try {
        const response = await fetch('/api/settings/public');
        const data = await response.json();
        setLocalLoginEnabled(data.local_login_enabled !== false);
      } catch (error) {
        console.error('Failed to load public settings:', error);
        // Default to enabled if fetch fails
        setLocalLoginEnabled(true);
      }
    };
    
    loadSSOProviders();
    loadPublicSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(id, password);
      showToast.success(t('auth.loginSuccess'));
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      let errorMsg = t('auth.loginFailed');
      
      // Handle specific error messages
      if (errorDetail) {
        if (errorDetail.includes('pending admin approval') || errorDetail.includes('pending approval')) {
          errorMsg = t('auth.accountPendingApproval');
        } else if (errorDetail.includes('Incorrect username or password')) {
          errorMsg = t('auth.incorrectCredentials');
        } else if (errorDetail.includes('disabled') || errorDetail.includes('inactive')) {
          errorMsg = t('auth.accountDisabled');
        } else {
          errorMsg = errorDetail;
        }
      }
      
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Show local login form if enabled OR if admin login button was clicked
  const shouldShowLocalLogin = localLoginEnabled || showAdminLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-yt-darker">
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="bg-yt-light p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Video className="w-12 h-12 text-yt-red mr-3" />
          <h1 className="text-3xl font-bold text-white">{t('app.title')}</h1>
        </div>

        {/* SSO Login Buttons */}
        {ssoProviders.length > 0 && (
          <div className="space-y-3 mb-6">
            {ssoProviders.map((provider) => (
              <SSOButton
                key={provider.provider}
                provider={provider.provider}
                displayName={t(`auth.sso.${provider.provider}`, provider.display_name)}
              />
            ))}
          </div>
        )}

        {/* Divider - only show if both SSO and local login are visible */}
        {ssoProviders.length > 0 && shouldShowLocalLogin && (
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-yt-light text-gray-400">{t('auth.sso.or')}</span>
            </div>
          </div>
        )}

        {/* Local Login Form - show if enabled or admin login clicked */}
        {shouldShowLocalLogin && (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.username')}
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.enterUsername')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
              placeholder={t('auth.enterPassword')}
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
          </form>
        )}

        {/* Admin Login Button - show only when local login is disabled and form is hidden */}
        {!localLoginEnabled && !showAdminLogin && ssoProviders.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowAdminLogin(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              title={t('auth.adminLoginHint')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t('auth.adminLogin')}
            </button>
          </div>
        )}

        {/* Registration Link - only show if local login is visible */}
        {shouldShowLocalLogin && (
          <div className="mt-6 text-center">
            {onShowRegister ? (
              <button
                onClick={onShowRegister}
                className="text-sm text-yt-red hover:text-red-400 transition-colors"
              >
                {t('auth.noAccount')} {t('auth.registerHere')}
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                {t('auth.registrationDisabled')}. {t('auth.contactAdmin')}
              </p>
            )}
          </div>
        )}

        {/* Legal Notice */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            {t('auth.legalNotice')}
          </p>
        </div>
      </div>
    </div>
  );
}
