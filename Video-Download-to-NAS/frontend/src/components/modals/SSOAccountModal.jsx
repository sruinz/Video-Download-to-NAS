import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Unlink, Shield, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getEnabledSSOProviders } from '../../api';
import showToast from '../../utils/toast';

// Provider 아이콘 (SSOButton과 동일)
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="currentColor"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const SynologyIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.48l7 3.5v7.84l-7-3.5V9.48zm16 0v7.84l-7 3.5v-7.84l7-3.5z"/>
  </svg>
);

const AuthentikIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
  </svg>
);

const GenericOIDCIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

const providerIcons = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
  github: GitHubIcon,
  synology: SynologyIcon,
  authentik: AuthentikIcon,
  generic_oidc: GenericOIDCIcon,
};

export default function SSOAccountModal({ isOpen, onClose, currentUser }) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await getEnabledSSOProviders();
      // 응답에서 providers 배열 추출
      const enabledProviders = response.providers || [];
      setProviders(Array.isArray(enabledProviders) ? enabledProviders : []);
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
      showToast.error(t('ssoAccount.loadFailed'));
      setProviders([]); // 에러 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  const handleLink = (provider) => {
    // SSO 연동 시작 - 백엔드 엔드포인트로 리다이렉트 (토큰 포함)
    const token = localStorage.getItem('token');
    window.location.href = `/api/sso/${provider}/link?token=${token}`;
  };

  const handleUnlink = async (provider) => {
    // SSO로 생성된 계정인지 확인
    const isSSOCreated = currentUser?.auth_provider !== 'local' && currentUser?.username?.includes('@');
    
    if (isSSOCreated) {
      // 비밀번호 설정 모달 표시
      setUnlinkProvider(provider);
      setShowPasswordModal(true);
    } else {
      // 기존 로컬 계정 - 바로 연동 해제
      performUnlink(provider, null);
    }
  };

  const performUnlink = async (provider, password) => {
    try {
      const response = await fetch(`/api/sso/${provider}/unlink`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_password: password
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to unlink SSO account');
      }

      showToast.success(t('ssoAccount.unlinkSuccess'));
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      
      // 페이지 새로고침하여 사용자 정보 업데이트
      window.location.reload();
    } catch (error) {
      console.error('Failed to unlink SSO:', error);
      showToast.error(error.message || t('ssoAccount.unlinkFailed'));
    }
  };

  const handlePasswordSubmit = () => {
    if (!newPassword) {
      showToast.error(t('ssoAccount.passwordCancelled'));
      return;
    }
    
    if (newPassword.length < 6) {
      showToast.error(t('ssoAccount.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast.error(t('changePassword.errors.notMatch'));
      return;
    }

    performUnlink(unlinkProvider, newPassword);
  };

  if (!isOpen) return null;

  // 현재 연동된 provider 확인
  const linkedProvider = currentUser?.auth_provider !== 'local' ? currentUser?.auth_provider : null;

  const Icon = linkedProvider && providerIcons[linkedProvider] 
    ? providerIcons[linkedProvider] 
    : Shield;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-yt-light rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-yt-red" />
            <h2 className="text-xl font-bold">{t('ssoAccount.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yt-dark rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 현재 연동 상태 */}
          <div className="bg-yt-dark p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-3">{t('ssoAccount.currentStatus')}</h3>
            {linkedProvider ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yt-light rounded-lg flex items-center justify-center">
                    <Icon />
                  </div>
                  <div>
                    <p className="font-medium">
                      {t(`auth.sso.${linkedProvider}`, linkedProvider)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {currentUser?.email || t('ssoAccount.noEmail', 'No email')}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
                </div>
                <button
                  onClick={() => handleUnlink(linkedProvider)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  <span>{t('ssoAccount.unlink')}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-400">
                <Shield className="w-10 h-10" />
                <div>
                  <p className="font-medium">{t('ssoAccount.localAccount')}</p>
                  <p className="text-sm">{t('ssoAccount.notLinked')}</p>
                </div>
              </div>
            )}
          </div>

          {/* 연동 가능한 Provider 목록 */}
          {!linkedProvider && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">{t('ssoAccount.availableProviders')}</h3>
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto border-4 border-gray-600 border-t-yt-red rounded-full animate-spin"></div>
                  <p className="text-gray-400 mt-2">{t('ssoAccount.loading')}</p>
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>{t('ssoAccount.noProviders')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map((provider) => {
                    const ProviderIcon = providerIcons[provider.provider] || GenericOIDCIcon;
                    
                    return (
                      <div
                        key={provider.provider}
                        className="flex items-center justify-between p-4 bg-yt-dark hover:bg-yt-darker rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yt-light rounded-lg flex items-center justify-center">
                            <ProviderIcon />
                          </div>
                          <div>
                            <p className="font-medium">
                              {t(`auth.sso.${provider.provider}`, provider.display_name)}
                            </p>
                            <p className="text-sm text-gray-400">
                              {provider.provider}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLink(provider.provider)}
                          className="flex items-center gap-2 px-4 py-2 bg-yt-red hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <LinkIcon className="w-4 h-4" />
                          <span>{t('ssoAccount.link')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              💡 {t('ssoAccount.info')}
            </p>
          </div>

          {/* SSO 연동 해제 안내 */}
          {linkedProvider && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <p className="text-sm text-yellow-200">
                ⚠️ {currentUser?.auth_provider !== 'local' && currentUser?.username?.includes('@')
                  ? t('ssoAccount.unlinkWarningSSO')
                  : t('ssoAccount.unlinkWarning')}
              </p>
              <p className="text-xs text-yellow-300 mt-2">
                {t('ssoAccount.yourUsername')}: <strong>{currentUser?.username}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            {t('ssoAccount.close')}
          </button>
        </div>
      </div>

      {/* 비밀번호 설정 모달 */}
      {showPasswordModal && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <div className="bg-yt-dark rounded-lg w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-bold mb-4">{t('ssoAccount.setPassword')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {t('ssoAccount.setPasswordDescription')}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('changePassword.newPassword')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('changePassword.newPasswordPlaceholder')}
                  className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('changePassword.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('changePassword.confirmPasswordPlaceholder')}
                  className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-yt-red hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                {t('modal.confirm')}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
