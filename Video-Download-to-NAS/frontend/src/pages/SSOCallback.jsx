import React, { useEffect, useState } from 'react';
import { Video, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import showToast from '../utils/toast';

export default function SSOCallback() {
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const handleCallback = () => {
      // Parse URL parameters
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const success = params.get('success');

      if (token) {
        // Success - store token and redirect
        localStorage.setItem('token', token);
        showToast.success(t('auth.sso.success'));
        
        // Check if there's a return URL (from share link)
        const returnUrl = sessionStorage.getItem('returnUrl');
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
          window.location.href = returnUrl;
        } else {
          // Navigate to home page
          window.location.href = '/';
        }
      } else if (success) {
        // Account linking success
        setProcessing(false);
        showToast.success(success);
        
        // Redirect to settings after showing success message
        setTimeout(() => {
          window.location.href = '/settings';
        }, 2000);
      } else if (error) {
        // Error occurred
        setProcessing(false);
        const errorMsg = errorDescription || error;
        setError(errorMsg);
        
        // Determine error type for better user guidance
        const lowerError = errorMsg.toLowerCase();
        if (lowerError.includes('denied') || lowerError.includes('access_denied')) {
          setErrorType('access_denied');
        } else if (lowerError.includes('state') || lowerError.includes('expired')) {
          setErrorType('state_error');
        } else if (lowerError.includes('email') && lowerError.includes('mismatch')) {
          setErrorType('email_mismatch');
        } else if (lowerError.includes('disabled') || lowerError.includes('registration')) {
          setErrorType('registration_disabled');
        } else if (lowerError.includes('network') || lowerError.includes('connection')) {
          setErrorType('network_error');
        } else if (lowerError.includes('not configured') || lowerError.includes('not available')) {
          setErrorType('provider_not_configured');
        } else {
          setErrorType('general');
        }
        
        showToast.error(errorMsg);
      } else {
        // No token or error - invalid callback
        setProcessing(false);
        setError(t('auth.sso.authenticationFailed'));
        setErrorType('general');
        showToast.error(t('auth.sso.authenticationFailed'));
      }
    };

    handleCallback();
  }, [t]);

  const handleRetry = () => {
    setRedirecting(true);
    window.location.href = '/';
  };

  const getErrorIcon = () => {
    return <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
  };

  const getErrorGuidance = () => {
    switch (errorType) {
      case 'access_denied':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.accessDenied')}
          </p>
        );
      case 'state_error':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.invalidState')}
          </p>
        );
      case 'email_mismatch':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.emailMismatch')}
          </p>
        );
      case 'registration_disabled':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.registrationDisabled')}
          </p>
        );
      case 'network_error':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.networkError')}
          </p>
        );
      case 'provider_not_configured':
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.providerNotConfigured')}
          </p>
        );
      default:
        return (
          <p className="text-gray-400 text-sm mt-2">
            {t('auth.sso.errors.unexpectedError')}
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-yt-darker">
      <div className="bg-yt-light p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Video className="w-12 h-12 text-yt-red mr-3" />
          <h1 className="text-3xl font-bold text-white">{t('app.title')}</h1>
        </div>

        {processing ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-600 border-t-yt-red rounded-full animate-spin"></div>
            <p className="text-gray-300 text-lg">{t('auth.loggingIn')}</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            {getErrorIcon()}
            
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-4">
              <p className="font-semibold mb-1">{t('auth.sso.authenticationFailed')}</p>
              <p className="text-sm">{error}</p>
            </div>
            
            {getErrorGuidance()}
            
            <div className="mt-6 space-y-3">
              <button
                onClick={handleRetry}
                disabled={redirecting}
                className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {redirecting ? (
                  <>
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('auth.redirecting')}...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    {t('auth.sso.errors.retryPrompt')}
                  </>
                )}
              </button>
              
              {errorType === 'registration_disabled' || errorType === 'provider_not_configured' ? (
                <p className="text-gray-500 text-xs">
                  {t('auth.contactAdmin')}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-300 text-lg mb-2">{t('auth.sso.success')}</p>
            <p className="text-gray-400 text-sm">{t('auth.redirecting')}...</p>
          </div>
        )}
      </div>
    </div>
  );
}
