import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Save, AlertCircle, CheckCircle, Eye, EyeOff, Plus, Key, Copy, RefreshCw } from 'lucide-react';
import showToast from '../utils/toast';

export default function SSOSettings({ onOpenGuide }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [expandedProviders, setExpandedProviders] = useState({});
  const [showAddGenericOIDC, setShowAddGenericOIDC] = useState(false);
  const [newOIDCProvider, setNewOIDCProvider] = useState({
    provider: '',
    display_name: '',
    client_id: '',
    client_secret: '',
    use_discovery: true,
    discovery_url: '',
    authorization_url: '',
    token_url: '',
    userinfo_url: ''
  });
  const [generatedKey, setGeneratedKey] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);

  // 기본 Provider 정의
  const defaultProviders = {
    google: { name: 'Google', icon: '🔵', fields: ['client_id', 'client_secret'] },
    microsoft: { name: 'Microsoft', icon: '🟦', fields: ['client_id', 'client_secret'] },
    github: { name: 'GitHub', icon: '⚫', fields: ['client_id', 'client_secret'] },
    synology: { name: 'Synology DSM', icon: '🔷', fields: ['client_id', 'client_secret', 'discovery_url'] },
    authentik: { name: 'Authentik', icon: '🟧', fields: ['client_id', 'client_secret', 'discovery_url'] }
  };

  // settings에서 모든 Provider를 동적으로 생성
  const providers = Object.keys(settings).map(providerId => {
    const providerSettings = settings[providerId];
    const defaultProvider = defaultProviders[providerId];
    
    return {
      id: providerId,
      name: providerSettings.display_name || defaultProvider?.name || providerId,
      icon: defaultProvider?.icon || '🔗',
      fields: defaultProvider?.fields || ['client_id', 'client_secret', 'discovery_url']
    };
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/sso/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load SSO settings');
      }

      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load SSO settings:', error);
      showToast.error(t('sso.settings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (providerId) => {
    const currentSettings = settings[providerId] || {};
    const newEnabled = !currentSettings.enabled;
    
    // 비활성화하는 경우 (ON → OFF)
    if (!newEnabled) {
      setSettings(prev => ({
        ...prev,
        [providerId]: {
          ...currentSettings,
          enabled: false
        }
      }));

      try {
        const response = await fetch(`/api/admin/sso/settings/${providerId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...currentSettings, enabled: false })
        });

        if (!response.ok) {
          throw new Error('Failed to disable provider');
        }

        showToast.success(t('sso.settings.disabled'));
        await loadSettings();
      } catch (error) {
        console.error('Failed to disable SSO provider:', error);
        showToast.error(t('sso.settings.toggleError'));
        setSettings(prev => ({
          ...prev,
          [providerId]: {
            ...currentSettings,
            enabled: true
          }
        }));
      }
      return;
    }
    
    // 활성화하려는 경우 (OFF → ON)
    // 키값이 없으면 입력폼만 열기 (에러 없이)
    if (!currentSettings.client_id || !currentSettings.client_secret) {
      setExpandedProviders(prev => ({ ...prev, [providerId]: true }));
      return;
    }
    
    // 키값이 있으면 활성화 + 저장
    setSettings(prev => ({
      ...prev,
      [providerId]: {
        ...currentSettings,
        enabled: true
      }
    }));

    try {
      const response = await fetch(`/api/admin/sso/settings/${providerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...currentSettings, enabled: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = t('sso.settings.toggleError');
        if (errorData.detail) {
          if (errorData.detail.includes('Client ID')) {
            errorMessage = t('sso.settings.missingClientId');
          } else if (errorData.detail.includes('Client Secret')) {
            errorMessage = t('sso.settings.missingClientSecret');
          } else {
            errorMessage = errorData.detail;
          }
        }
        throw new Error(errorMessage);
      }

      showToast.success(t('sso.settings.enabled'));
      await loadSettings();
    } catch (error) {
      console.error('Failed to enable SSO provider:', error);
      showToast.error(error.message);
      setSettings(prev => ({
        ...prev,
        [providerId]: {
          ...currentSettings,
          enabled: false
        }
      }));
    }
  };

  const handleFieldChange = (providerId, field, value) => {
    setSettings(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value
      }
    }));
  };

  const toggleSecretVisibility = (providerId) => {
    setShowSecrets(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const generateEncryptionKey = async () => {
    setGeneratingKey(true);
    try {
      const response = await fetch('/api/admin/sso/generate-encryption-key', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate encryption key');
      }

      const data = await response.json();
      setGeneratedKey(data.encryption_key);
      showToast.success(t('sso.settings.keyGenerated'));
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      showToast.error(t('sso.settings.keyGenerateError'));
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyKeyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    showToast.success(t('sso.settings.keyCopied'));
  };

  const handleSave = async (providerId) => {
    setSaving(true);
    try {
      const providerSettings = settings[providerId] || {};

      // 필수 필드 검증
      if (!providerSettings.client_id || !providerSettings.client_secret) {
        showToast.error(t('sso.settings.missingFields'));
        setSaving(false);
        return;
      }

      // 키값이 입력되어 있으면 활성화
      const settingsToSave = {
        ...providerSettings,
        enabled: true
      };

      const response = await fetch(`/api/admin/sso/settings/${providerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToSave)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save settings');
      }

      showToast.success(t('sso.settings.saveSuccess'));
      
      await loadSettings(); // 설정 다시 로드 (폼은 열린 상태 유지)
    } catch (error) {
      console.error('Failed to save SSO settings:', error);
      showToast.error(error.message || t('sso.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearSettings = async (providerId) => {
    if (!confirm(t('sso.settings.clearConfirm') || '입력한 설정 값을 모두 삭제하시겠습니까?')) {
      return;
    }

    setSaving(true);
    try {
      // 빈 설정으로 업데이트 (enabled: false)
      const emptySettings = {
        enabled: false,
        client_id: '',
        client_secret: '',
        authorization_url: '',
        token_url: '',
        userinfo_url: '',
        discovery_url: ''
      };

      const response = await fetch(`/api/admin/sso/settings/${providerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emptySettings)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to clear settings');
      }

      showToast.success(t('sso.settings.clearSuccess') || '설정이 삭제되었습니다');
      await loadSettings(); // 설정 다시 로드
    } catch (error) {
      console.error('Failed to clear SSO settings:', error);
      showToast.error(error.message || t('sso.settings.clearError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (providerId) => {
    if (!confirm(t('sso.settings.deleteConfirm') || '이 Provider를 완전히 삭제하시겠습니까?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/sso/settings/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete provider');
      }

      showToast.success(t('sso.settings.deleteSuccess') || 'Provider가 삭제되었습니다');
      await loadSettings(); // 설정 다시 로드
    } catch (error) {
      console.error('Failed to delete SSO provider:', error);
      showToast.error(error.message || t('sso.settings.deleteError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddGenericOIDC = async () => {
    // 필수 필드 검증
    if (!newOIDCProvider.provider || !newOIDCProvider.display_name || 
        !newOIDCProvider.client_id || !newOIDCProvider.client_secret) {
      showToast.error(t('sso.settings.genericOIDC.missingProviderInfo'));
      return;
    }

    if (newOIDCProvider.use_discovery) {
      if (!newOIDCProvider.discovery_url) {
        showToast.error(t('sso.settings.genericOIDC.missingDiscoveryUrl'));
        return;
      }
    } else {
      if (!newOIDCProvider.authorization_url || !newOIDCProvider.token_url || !newOIDCProvider.userinfo_url) {
        showToast.error(t('sso.settings.genericOIDC.missingManualUrls'));
        return;
      }
    }

    setSaving(true);
    try {
      const providerData = {
        provider: newOIDCProvider.provider,
        provider_type: 'oidc',
        display_name: newOIDCProvider.display_name,
        client_id: newOIDCProvider.client_id,
        client_secret: newOIDCProvider.client_secret,
        enabled: false,
        scopes: 'openid email profile'
      };

      if (newOIDCProvider.use_discovery) {
        providerData.discovery_url = newOIDCProvider.discovery_url;
      } else {
        providerData.authorization_url = newOIDCProvider.authorization_url;
        providerData.token_url = newOIDCProvider.token_url;
        providerData.userinfo_url = newOIDCProvider.userinfo_url;
      }

      const response = await fetch(`/api/admin/sso/settings/${newOIDCProvider.provider}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add provider');
      }

      showToast.success(t('sso.settings.genericOIDC.addSuccess'));
      
      // 폼 초기화
      setNewOIDCProvider({
        provider: '',
        display_name: '',
        client_id: '',
        client_secret: '',
        use_discovery: true,
        discovery_url: '',
        authorization_url: '',
        token_url: '',
        userinfo_url: ''
      });
      setShowAddGenericOIDC(false);
      
      await loadSettings(); // 설정 다시 로드
    } catch (error) {
      console.error('Failed to add Generic OIDC provider:', error);
      showToast.error(error.message || t('sso.settings.genericOIDC.addError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">{t('sso.settings.title')}</h1>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-semibold mb-1">{t('sso.settings.infoTitle')}</p>
            <p>{t('sso.settings.infoDescription')}</p>
          </div>
        </div>
      </div>

      {/* 암호화 키 생성 섹션 */}
      <div className="bg-yt-dark rounded-lg border border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-6 h-6 text-yellow-500" />
          <h2 className="text-lg font-semibold text-white">{t('sso.settings.encryptionKey.title')}</h2>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          {t('sso.settings.encryptionKey.description')}
        </p>

        <div className="space-y-4">
          <button
            onClick={generateEncryptionKey}
            disabled={generatingKey}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${generatingKey ? 'animate-spin' : ''}`} />
            {generatingKey ? t('sso.settings.encryptionKey.generating') : t('sso.settings.encryptionKey.generate')}
          </button>

          {generatedKey && (
            <div className="bg-yt-darker rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-2">
                    {t('sso.settings.encryptionKey.generatedTitle')}
                  </p>
                  <code className="block text-xs text-green-400 bg-black/50 p-3 rounded break-all font-mono">
                    {generatedKey}
                  </code>
                </div>
                <button
                  onClick={copyKeyToClipboard}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex-shrink-0"
                  title={t('sso.settings.encryptionKey.copy')}
                >
                  <Copy className="w-4 h-4" />
                  {t('sso.settings.encryptionKey.copy')}
                </button>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                <p className="text-xs text-yellow-300">
                  <strong>{t('sso.settings.encryptionKey.instructions.title')}</strong>
                </p>
                <ol className="text-xs text-yellow-300 mt-2 space-y-1 list-decimal list-inside">
                  <li>{t('sso.settings.encryptionKey.instructions.step1')}</li>
                  <li>{t('sso.settings.encryptionKey.instructions.step2')}</li>
                  <li>{t('sso.settings.encryptionKey.instructions.step3')}</li>
                  <li>{t('sso.settings.encryptionKey.instructions.step4')}</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {providers.map(provider => {
          const providerSettings = settings[provider.id] || {};
          const isEnabled = providerSettings.enabled || false;

          return (
            <div
              key={provider.id}
              className="bg-yt-dark rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                    <p className="text-sm text-gray-400">
                      {isEnabled ? t('sso.settings.enabled') : t('sso.settings.disabled')}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggle(provider.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Settings Form */}
              <div className="p-4 space-y-4">
                {(isEnabled || expandedProviders[provider.id]) && (
                  <>
                    {provider.fields.map(field => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t(`sso.settings.fields.${field}`)}
                          {(field === 'client_id' || field === 'client_secret') && (
                            <span className="text-red-400 ml-1">*</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={field === 'client_secret' && !showSecrets[provider.id] ? 'password' : 'text'}
                            value={providerSettings[field] || ''}
                            onChange={(e) => handleFieldChange(provider.id, field, e.target.value)}
                            placeholder={
                              field === 'client_secret' 
                                ? '••••••••••••••••' 
                                : t(`sso.settings.placeholders.${field}`)
                            }
                            className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                          />
                          {field === 'client_secret' && (
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                              {showSecrets[provider.id] ? (
                                <EyeOff className="w-5 h-5" />
                              ) : (
                                <Eye className="w-5 h-5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {(isEnabled || expandedProviders[provider.id]) && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={saving}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {t('permissions.saving')}
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          {t('permissions.save')}
                        </>
                      )}
                    </button>
                    
                    {/* 기본 Provider는 초기화, 커스텀 Provider는 삭제 */}
                    {['google', 'microsoft', 'github', 'synology', 'authentik'].includes(provider.id) ? (
                      <button
                        onClick={() => handleClearSettings(provider.id)}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                      >
                        {t('modal.clear')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        disabled={saving}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                      >
                        {t('modal.delete')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Generic OIDC Provider 추가 섹션 */}
      <div className="mt-8 bg-yt-dark rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('sso.settings.genericOIDC.title')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('sso.settings.genericOIDC.description')}</p>
          </div>
          <button
            onClick={() => setShowAddGenericOIDC(!showAddGenericOIDC)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('sso.settings.genericOIDC.addButton')}
          </button>
        </div>

        {showAddGenericOIDC && (
          <div className="p-4 space-y-4 bg-yt-darker">
            {/* Provider ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('sso.settings.genericOIDC.providerId')}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="text"
                value={newOIDCProvider.provider}
                onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, provider: e.target.value }))}
                placeholder={t('sso.settings.genericOIDC.providerIdPlaceholder')}
                className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('sso.settings.genericOIDC.providerIdHint')}</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('sso.settings.genericOIDC.displayName')}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="text"
                value={newOIDCProvider.display_name}
                onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder={t('sso.settings.genericOIDC.displayNamePlaceholder')}
                className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Client ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('sso.settings.genericOIDC.clientId')}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="text"
                value={newOIDCProvider.client_id}
                onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, client_id: e.target.value }))}
                required
                placeholder={t('sso.settings.genericOIDC.clientIdPlaceholder')}
                className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('sso.settings.genericOIDC.clientSecret')}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input
                type="password"
                value={newOIDCProvider.client_secret}
                onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, client_secret: e.target.value }))}
                required
                placeholder={t('sso.settings.genericOIDC.clientSecretPlaceholder')}
                className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Discovery URL vs Manual Configuration */}
            <div className="border border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={newOIDCProvider.use_discovery}
                    onChange={() => setNewOIDCProvider(prev => ({ ...prev, use_discovery: true }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-white">{t('sso.settings.genericOIDC.useDiscovery')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!newOIDCProvider.use_discovery}
                    onChange={() => setNewOIDCProvider(prev => ({ ...prev, use_discovery: false }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-white">{t('sso.settings.genericOIDC.manualConfig')}</span>
                </label>
              </div>

              {newOIDCProvider.use_discovery ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('sso.settings.fields.discovery_url')}
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={newOIDCProvider.discovery_url}
                    onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, discovery_url: e.target.value }))}
                    placeholder={t('sso.settings.placeholders.discovery_url')}
                    className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('sso.settings.genericOIDC.discoveryHint')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('sso.settings.fields.authorization_url')}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={newOIDCProvider.authorization_url}
                      onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, authorization_url: e.target.value }))}
                      placeholder={t('sso.settings.placeholders.authorization_url')}
                      className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('sso.settings.fields.token_url')}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={newOIDCProvider.token_url}
                      onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, token_url: e.target.value }))}
                      placeholder={t('sso.settings.placeholders.token_url')}
                      className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('sso.settings.fields.userinfo_url')}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={newOIDCProvider.userinfo_url}
                      onChange={(e) => setNewOIDCProvider(prev => ({ ...prev, userinfo_url: e.target.value }))}
                      placeholder={t('sso.settings.placeholders.userinfo_url')}
                      className="w-full bg-yt-dark border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAddGenericOIDC}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    {t('sso.settings.genericOIDC.addProvider')}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddGenericOIDC(false);
                  setNewOIDCProvider({
                    provider: '',
                    display_name: '',
                    client_id: '',
                    client_secret: '',
                    use_discovery: true,
                    discovery_url: '',
                    authorization_url: '',
                    token_url: '',
                    userinfo_url: ''
                  });
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('modal.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Setup Guide Link */}
      <div className="mt-8 bg-yt-dark rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          {t('sso.settings.setupGuide.title')}
        </h3>
        <p className="text-sm text-gray-400 mb-3">
          {t('sso.settings.setupGuide.description')}
        </p>
        <button
          onClick={onOpenGuide}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          {t('sso.settings.setupGuide.link')} →
        </button>
      </div>
    </div>
  );
}
