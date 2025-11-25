import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeft, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import showToast from '../utils/toast';

export default function SSOSetupGuide({ onBack }) {
  const { t } = useTranslation();
  const [redirectUris, setRedirectUris] = useState({});
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch actual redirect URIs from backend
    const fetchRedirectUris = async () => {
      try {
        const response = await fetch('/api/sso/redirect-uris');
        if (response.ok) {
          const data = await response.json();
          setRedirectUris(data.providers);
          setBaseUrl(data.base_url);
        }
      } catch (error) {
        console.error('Failed to fetch redirect URIs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRedirectUris();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast.success(t('common.copied'));
  };

  const providers = [
    {
      id: 'google',
      name: 'Google',
      icon: '🔵',
      consoleUrl: 'https://console.cloud.google.com/apis/credentials',
      steps: t('ssoGuide.steps.google', { returnObjects: true }),
      redirectUri: redirectUris.google || 'http://your-domain:8000/api/sso/google/callback',
      scopes: 'openid email profile'
    },
    {
      id: 'microsoft',
      name: 'Microsoft Entra ID',
      icon: '🟦',
      consoleUrl: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      steps: t('ssoGuide.steps.microsoft', { returnObjects: true }),
      redirectUri: redirectUris.microsoft || 'http://your-domain:8000/api/sso/microsoft/callback',
      scopes: 'openid email profile User.Read'
    },
    {
      id: 'github',
      name: 'GitHub',
      icon: '⚫',
      consoleUrl: 'https://github.com/settings/developers',
      steps: t('ssoGuide.steps.github', { returnObjects: true }),
      redirectUri: redirectUris.github || 'http://your-domain:8000/api/sso/github/callback',
      scopes: 'read:user user:email'
    },
    {
      id: 'synology',
      name: 'Synology DSM (OIDC)',
      icon: '🔷',
      consoleUrl: null,
      steps: t('ssoGuide.steps.synology', { returnObjects: true }),
      redirectUri: redirectUris.synology || 'http://your-domain:8000/api/sso/synology/callback',
      discoveryUrl: 'https://your-synology-domain/.well-known/openid-configuration'
    },
    {
      id: 'authentik',
      name: 'Authentik',
      icon: '🟧',
      consoleUrl: null,
      steps: t('ssoGuide.steps.authentik', { returnObjects: true }),
      redirectUri: redirectUris.authentik || 'http://your-domain:8000/api/sso/authentik/callback',
      discoveryUrl: 'https://your-authentik-domain/application/o/your-app-slug/.well-known/openid-configuration'
    },
    {
      id: 'generic_oidc',
      name: 'Generic OIDC',
      icon: '🔗',
      consoleUrl: null,
      steps: t('ssoGuide.steps.genericOIDC', { returnObjects: true }),
      redirectUri: redirectUris.generic_oidc || 'http://your-domain:8000/api/sso/{provider-id}/callback',
      discoveryUrl: 'https://your-oidc-provider/.well-known/openid-configuration'
    }
  ];

  return (
    <div className="min-h-screen bg-yt-darker text-white">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('ssoGuide.goToSettings')}</span>
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold">{t('ssoGuide.title')}</h1>
          </div>
          
          <p className="text-gray-400">
            {t('ssoGuide.description')}
          </p>

          {loading && (
            <div className="mt-4 text-sm text-gray-500">
              ⏳ {t('ssoGuide.loadingServerUrl')}
            </div>
          )}

          {!loading && baseUrl && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
              <p className="text-sm text-green-400">
                ✅ {t('ssoGuide.serverUrl')}: <span className="font-mono">{baseUrl}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t('ssoGuide.autoRedirectUri')}
              </p>
            </div>
          )}
        </div>

        {/* 일반 안내 */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('ssoGuide.general.title')}</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              <strong>{t('ssoGuide.general.step1.title')}</strong><br />
              {t('ssoGuide.general.step1.description')}
            </p>
            <p>
              <strong>{t('ssoGuide.general.step2.title')}</strong><br />
              {t('ssoGuide.general.step2.description')}
            </p>
            <p>
              <strong>{t('ssoGuide.general.step3.title')}</strong><br />
              {t('ssoGuide.general.step3.description')}
            </p>
          </div>
        </div>

        {/* Provider별 가이드 */}
        <div className="space-y-6">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-yt-dark rounded-lg border border-gray-700 overflow-hidden">
              {/* Provider Header */}
              <div className="bg-yt-light p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{provider.icon}</span>
                    <h3 className="text-xl font-semibold">{provider.name}</h3>
                  </div>
                  {provider.consoleUrl && (
                    <a
                      href={provider.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{t('ssoGuide.openConsole')}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Provider Content */}
              <div className="p-6 space-y-6">
                {/* 설정 단계 */}
                <div>
                  <h4 className="font-semibold mb-3">{t('ssoGuide.setupSteps')}</h4>
                  <ol className="space-y-2 list-decimal list-inside text-gray-300">
                    {provider.steps.map((step, index) => (
                      <li key={index} className="text-sm">{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Redirect URI */}
                <div>
                  <h4 className="font-semibold mb-2">{t('ssoGuide.redirectUri')}</h4>
                  
                  {/* HTTP 예시 */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">{t('ssoGuide.httpExample')}</p>
                    <div className="flex items-center gap-2 bg-yt-darker p-3 rounded-lg">
                      <code className="flex-1 text-sm text-green-400 font-mono">
                        {provider.redirectUri}
                      </code>
                      <button
                        onClick={() => copyToClipboard(provider.redirectUri)}
                        className="p-2 hover:bg-yt-light rounded transition-colors"
                        title={t('common.copy')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* HTTPS 예시 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t('ssoGuide.httpsExample')}</p>
                    <div className="flex items-center gap-2 bg-yt-darker p-3 rounded-lg">
                      <code className="flex-1 text-sm text-blue-400 font-mono">
                        {provider.redirectUri.replace('http://', 'https://').replace(':8000', '')}
                      </code>
                      <button
                        onClick={() => copyToClipboard(provider.redirectUri.replace('http://', 'https://').replace(':8000', ''))}
                        className="p-2 hover:bg-yt-light rounded transition-colors"
                        title={t('common.copy')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ {t('ssoGuide.replaceYourDomain')}
                  </p>
                </div>

                {/* Scopes */}
                {provider.scopes && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('ssoGuide.scopes')}</h4>
                    <div className="bg-yt-darker p-3 rounded-lg">
                      <code className="text-sm text-blue-400 font-mono">
                        {provider.scopes}
                      </code>
                    </div>
                  </div>
                )}

                {/* Additional URLs (Synology) */}
                {provider.additionalUrls && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('ssoGuide.additionalUrls')}</h4>
                    <div className="space-y-2">
                      {Object.entries(provider.additionalUrls).map(([key, url]) => (
                        <div key={key}>
                          <p className="text-xs text-gray-400 mb-1 capitalize">{key} URL:</p>
                          <div className="flex items-center gap-2 bg-yt-darker p-2 rounded">
                            <code className="flex-1 text-xs text-green-400 font-mono">
                              {url}
                            </code>
                            <button
                              onClick={() => copyToClipboard(url)}
                              className="p-1 hover:bg-yt-light rounded transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discovery URL (OIDC Providers) */}
                {provider.discoveryUrl && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('ssoGuide.discoveryUrl')}</h4>
                    <div className="bg-yt-darker p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2">
                        {provider.id === 'synology' 
                          ? t('ssoGuide.synologyWellKnown')
                          : provider.id === 'authentik'
                          ? t('ssoGuide.authentikDiscovery')
                          : t('ssoGuide.oidcDiscovery')}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm text-blue-400 font-mono">
                          {provider.discoveryUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(provider.discoveryUrl)}
                          className="p-2 hover:bg-yt-light rounded transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {provider.id === 'synology' 
                          ? `⚠️ ${t('ssoGuide.replaceSynologyDomain')}` 
                          : `⚠️ ${t('ssoGuide.replaceAuthentikValues')}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 문제 해결 */}
        <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>💡</span>
            <span>{t('ssoGuide.troubleshooting.title')}</span>
          </h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <strong>{t('ssoGuide.troubleshooting.issue1.title')}</strong>
              <p className="text-gray-400 mt-1">{t('ssoGuide.troubleshooting.issue1.solution')}</p>
            </div>
            <div>
              <strong>{t('ssoGuide.troubleshooting.issue2.title')}</strong>
              <p className="text-gray-400 mt-1">{t('ssoGuide.troubleshooting.issue2.solution')}</p>
            </div>
            <div>
              <strong>{t('ssoGuide.troubleshooting.issue3.title')}</strong>
              <p className="text-gray-400 mt-1">{t('ssoGuide.troubleshooting.issue3.solution')}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yt-red hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{t('ssoGuide.goToSettings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
