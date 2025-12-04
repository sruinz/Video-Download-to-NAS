import React, { useState, useEffect } from 'react';
import { X, User, Mail, Key, Save, Shield, Link as LinkIcon, Unlink, CheckCircle, Code, Copy, Trash2, Plus, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateCurrentUser, getSettings, getEnabledSSOProviders, getAPITokens, createAPIToken, revokeAPIToken, getTelegramBotStatus, setupTelegramBot, updateTelegramBot, startTelegramBot, stopTelegramBot, testTelegramBot, deleteTelegramBot, resetTelegramBotChatId, getFolderOrganization, updateFolderOrganization } from '../../api';
import showToast from '../../utils/toast';

// Provider 아이콘 (SSOAccountModal과 동일)
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

export default function AccountSettingsModal({ isOpen, onClose, currentUser, onSuccess }) {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    displayName: currentUser?.display_name || '',
    email: currentUser?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // profile, security, sso, api-tokens, folder-organization
  const [ssoProviders, setSSOProviders] = useState([]);
  const [loadingSSOProviders, setLoadingSSOProviders] = useState(false);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // API Tokens state
  const [apiTokens, setApiTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  
  // Telegram Bot state
  const [botStatus, setBotStatus] = useState(null);
  const [loadingBot, setLoadingBot] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botMode, setBotMode] = useState('best');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [progressNotifications, setProgressNotifications] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [showDeleteBotModal, setShowDeleteBotModal] = useState(false);
  
  // Folder Organization state
  const [folderMode, setFolderMode] = useState('root');
  const [firstLevel, setFirstLevel] = useState('none');
  const [secondLevel, setSecondLevel] = useState('none');
  const [loadingFolderSettings, setLoadingFolderSettings] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form data when modal opens
      setFormData({
        displayName: currentUser?.display_name || '',
        email: currentUser?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Load cooldown setting
      const loadSettings = async () => {
        try {
          if (currentUser?.role === 'super_admin') {
            const settings = await getSettings();
            setCooldownDays(settings.display_name_change_cooldown_days || 30);
          } else {
            // For non-super_admin, fetch from public endpoint
            const response = await fetch('/api/settings/public/cooldown');
            if (response.ok) {
              const data = await response.json();
              setCooldownDays(data.display_name_change_cooldown_days || 30);
            } else {
              setCooldownDays(30); // Default value
            }
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
          setCooldownDays(30); // Fallback to default
        }
      };
      loadSettings();

      // SSO 탭일 때 providers 로드
      if (activeTab === 'sso') {
        loadSSOProviders();
      }
      
      // API Tokens 탭일 때 토큰 로드
      if (activeTab === 'api-tokens') {
        loadAPITokens();
      }
      
      // Telegram Bot 탭일 때 봇 상태 로드
      if (activeTab === 'telegram-bot') {
        loadBotStatus();
      }
      
      // Folder Organization 탭일 때 설정 로드
      if (activeTab === 'folder-organization') {
        loadFolderOrganizationSettings();
      }
    }
  }, [isOpen, currentUser, activeTab]);

  const loadAPITokens = async () => {
    try {
      setLoadingTokens(true);
      const tokens = await getAPITokens();
      setApiTokens(tokens);
    } catch (error) {
      console.error('Failed to load API tokens:', error);
      showToast.error(t('apiTokens.loadFailed'));
      setApiTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      showToast.error(t('apiTokens.nameRequired'));
      return;
    }

    try {
      const result = await createAPIToken(newTokenName);
      setCreatedToken(result);
      setShowCreateTokenModal(false);
      setNewTokenName('');
      await loadAPITokens();
      showToast.success(t('apiTokens.created'));
    } catch (error) {
      console.error('Failed to create token:', error);
      showToast.error(error.message || t('apiTokens.createFailed'));
    }
  };

  const handleRevokeToken = async (tokenId, tokenName) => {
    if (!confirm(t('apiTokens.confirmRevoke', { name: tokenName }))) {
      return;
    }

    try {
      await revokeAPIToken(tokenId);
      await loadAPITokens();
      showToast.success(t('apiTokens.revoked'));
    } catch (error) {
      console.error('Failed to revoke token:', error);
      showToast.error(t('apiTokens.revokeFailed'));
    }
  };

  const copyToClipboard = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(message || t('apiTokens.copied'));
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast.error(t('apiTokens.copyFailed'));
    }
  };

  // Telegram Bot functions
  const loadBotStatus = async () => {
    try {
      setLoadingBot(true);
      const status = await getTelegramBotStatus();
      if (status) {
        setBotStatus(status);
        setBotMode(status.bot_mode);
        setNotificationsEnabled(status.notifications_enabled);
        setProgressNotifications(status.progress_notifications);
      } else {
        setBotStatus(null);
      }
    } catch (error) {
      console.error('Failed to load bot status:', error);
      setBotStatus(null);
    } finally {
      setLoadingBot(false);
    }
  };

  const handleSetupBot = async () => {
    if (!botToken.trim()) {
      showToast.error(t('telegramBot.tokenRequired') || 'Bot token is required');
      return;
    }

    try {
      setLoadingBot(true);
      await setupTelegramBot(botToken, botMode, notificationsEnabled, progressNotifications);
      showToast.success(t('telegramBot.setupSuccess') || 'Bot setup successfully');
      setBotToken('');
      await loadBotStatus();
    } catch (error) {
      console.error('Failed to setup bot:', error);
      // API 에러 메시지 추출
      let errorMessage = t('telegramBot.setupFailed');
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        // 특정 에러 메시지에 대한 번역 처리
        if (detail.includes('Existing API token found')) {
          errorMessage = t('telegramBot.errors.existingToken');
        } else if (detail.includes('Invalid bot token')) {
          errorMessage = t('telegramBot.errors.invalidToken');
        } else if (detail.includes('Failed to start bot')) {
          errorMessage = t('telegramBot.errors.startFailed');
        } else {
          errorMessage = detail;
        }
      }
      showToast.error(errorMessage);
    } finally {
      setLoadingBot(false);
    }
  };

  const handleUpdateBot = async () => {
    try {
      setLoadingBot(true);
      await updateTelegramBot(botMode, notificationsEnabled, progressNotifications);
      showToast.success(t('telegramBot.updateSuccess') || 'Bot updated successfully');
      await loadBotStatus();
    } catch (error) {
      console.error('Failed to update bot:', error);
      showToast.error(t('telegramBot.updateFailed') || 'Failed to update bot');
    } finally {
      setLoadingBot(false);
    }
  };

  const handleStartBot = async () => {
    try {
      setLoadingBot(true);
      await startTelegramBot();
      showToast.success(t('telegramBot.startSuccess') || 'Bot started successfully');
      await loadBotStatus();
    } catch (error) {
      console.error('Failed to start bot:', error);
      showToast.error(t('telegramBot.startFailed') || 'Failed to start bot');
    } finally {
      setLoadingBot(false);
    }
  };

  const handleStopBot = async () => {
    try {
      setLoadingBot(true);
      await stopTelegramBot();
      showToast.success(t('telegramBot.stopSuccess') || 'Bot stopped successfully');
      await loadBotStatus();
    } catch (error) {
      console.error('Failed to stop bot:', error);
      showToast.error(t('telegramBot.stopFailed') || 'Failed to stop bot');
    } finally {
      setLoadingBot(false);
    }
  };

  const handleTestBot = async () => {
    if (!botToken.trim()) {
      showToast.error(t('telegramBot.tokenRequired') || 'Bot token is required');
      return;
    }

    try {
      setTestingBot(true);
      const result = await testTelegramBot(botToken);
      if (result.success) {
        showToast.success(t('telegramBot.testSuccess', { username: result.bot_username }) || `Bot connected: @${result.bot_username}`);
      } else {
        showToast.error(result.error || t('telegramBot.testFailed') || 'Bot test failed');
      }
    } catch (error) {
      console.error('Failed to test bot:', error);
      showToast.error(error.message || t('telegramBot.testFailed') || 'Failed to test bot');
    } finally {
      setTestingBot(false);
    }
  };

  const handleDeleteBot = async () => {
    try {
      setLoadingBot(true);
      setShowDeleteBotModal(false);
      await deleteTelegramBot();
      showToast.success(t('telegramBot.deleteSuccess') || 'Bot deleted successfully');
      setBotStatus(null);
      setBotToken('');
    } catch (error) {
      console.error('Failed to delete bot:', error);
      showToast.error(t('telegramBot.deleteFailed') || 'Failed to delete bot');
    } finally {
      setLoadingBot(false);
    }
  };

  const handleResetChatId = async () => {
    try {
      setLoadingBot(true);
      await resetTelegramBotChatId();
      showToast.success(t('telegramBot.chatIdResetSuccess') || 'Chat ID reset successfully. Please send /start in Telegram again.');
      await loadBotStatus();
    } catch (error) {
      console.error('Failed to reset chat ID:', error);
      showToast.error(t('telegramBot.chatIdResetFailed') || 'Failed to reset chat ID');
    } finally {
      setLoadingBot(false);
    }
  };

  // Folder Organization functions
  const loadFolderOrganizationSettings = async () => {
    try {
      setLoadingFolderSettings(true);
      const response = await getFolderOrganization();
      setFolderMode(response.mode);
      // Parse mode into first and second level
      const { first, second } = parseFolderMode(response.mode);
      setFirstLevel(first);
      setSecondLevel(second);
    } catch (error) {
      console.error('Failed to load folder organization settings:', error);
      showToast.error(t('settings.system.folderOrganizationFailed'));
    } finally {
      setLoadingFolderSettings(false);
    }
  };

  const handleSaveFolderOrganization = async () => {
    try {
      setLoadingFolderSettings(true);
      // Combine first and second level into mode
      const mode = combineFolderMode(firstLevel, secondLevel);
      await updateFolderOrganization(mode);
      setFolderMode(mode);
      showToast.success(t('settings.system.folderOrganizationSaved'));
    } catch (error) {
      console.error('Failed to save folder organization settings:', error);
      showToast.error(t('settings.system.folderOrganizationFailed'));
    } finally {
      setLoadingFolderSettings(false);
    }
  };

  // Convert snake_case to camelCase for translation keys
  const toCamelCase = (str) => {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  };

  // Parse folder mode into first and second level
  const parseFolderMode = (mode) => {
    if (mode === 'root') return { first: 'none', second: 'none' };
    if (mode === 'date') return { first: 'date', second: 'none' };
    if (mode === 'site_full') return { first: 'site_full', second: 'none' };
    if (mode === 'site_name') return { first: 'site_name', second: 'none' };
    if (mode === 'date_site_full') return { first: 'date', second: 'site_full' };
    if (mode === 'date_site_name') return { first: 'date', second: 'site_name' };
    if (mode === 'site_full_date') return { first: 'site_full', second: 'date' };
    if (mode === 'site_name_date') return { first: 'site_name', second: 'date' };
    return { first: 'none', second: 'none' };
  };

  // Combine first and second level into folder mode
  const combineFolderMode = (first, second) => {
    if (first === 'none') return 'root';
    if (second === 'none') {
      if (first === 'date') return 'date';
      if (first === 'site_full') return 'site_full';
      if (first === 'site_name') return 'site_name';
    }
    if (first === 'date') {
      if (second === 'site_full') return 'date_site_full';
      if (second === 'site_name') return 'date_site_name';
    }
    if (first === 'site_full') {
      if (second === 'date') return 'site_full_date';
    }
    if (first === 'site_name') {
      if (second === 'date') return 'site_name_date';
    }
    return 'root';
  };

  // Get available second level options based on first level
  const getSecondLevelOptions = (first) => {
    if (first === 'date') return ['site_full', 'site_name'];
    if (first === 'site_full' || first === 'site_name') return ['date'];
    return [];
  };

  // Handle first level change
  const handleFirstLevelChange = (value) => {
    setFirstLevel(value);
    // Reset second level if it's not compatible
    const availableOptions = getSecondLevelOptions(value);
    if (value === 'none' || !availableOptions.includes(secondLevel)) {
      setSecondLevel('none');
    }
  };

  const getFolderPreview = (mode) => {
    const username = currentUser?.username || 'username';
    const examples = {
      'root': `${username}/video.mp4`,
      'date': `${username}/2025-12-04/video.mp4`,
      'site_full': `${username}/example.com/video.mp4`,
      'site_name': `${username}/example/video.mp4`,
      'date_site_full': `${username}/2025-12-04/example.com/video.mp4`,
      'date_site_name': `${username}/2025-12-04/example/video.mp4`,
      'site_full_date': `${username}/example.com/2025-12-04/video.mp4`,
      'site_name_date': `${username}/example/2025-12-04/video.mp4`
    };
    return examples[mode] || examples['root'];
  };

  const loadSSOProviders = async () => {
    try {
      setLoadingSSOProviders(true);
      const response = await getEnabledSSOProviders();
      setSSOProviders(response.providers || []);
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
      showToast.error(t('ssoAccount.loadFailed'));
      setSSOProviders([]);
    } finally {
      setLoadingSSOProviders(false);
    }
  };

  const handleLinkSSO = (provider) => {
    const token = localStorage.getItem('token');
    window.location.href = `/api/sso/${provider}/link?token=${token}`;
  };

  const handleUnlinkSSO = async (provider) => {
    // SSO로 생성된 계정인지 확인
    const isSSOCreated = currentUser?.auth_provider !== 'local' && currentUser?.username?.includes('@');
    
    if (isSSOCreated) {
      // 비밀번호 설정 모달 표시
      setUnlinkProvider(provider);
      setShowPasswordModal(true);
    } else {
      // 기존 로컬 계정 - 바로 연동 해제
      performUnlinkSSO(provider, null);
    }
  };

  const performUnlinkSSO = async (provider, password) => {
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

    performUnlinkSSO(unlinkProvider, newPassword);
  };

  if (!isOpen) return null;
  
  // SSO 사용자는 이메일 변경 불가
  const canChangeEmail = currentUser?.auth_provider === 'local';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const updateData = {};
      
      // Profile updates
      if (activeTab === 'profile') {
        // Display name
        if (formData.displayName !== currentUser?.display_name) {
          if (formData.displayName.trim().length > 20) {
            showToast.error(t('profile.displayNameTooLong'));
            return;
          }
          updateData.display_name = formData.displayName.trim();
        }
        
        // Email
        if (formData.email !== currentUser?.email) {
          if (!formData.email.includes('@')) {
            showToast.error(t('profile.invalidEmail'));
            return;
          }
          updateData.email = formData.email.trim();
        }
      }
      
      // Security updates
      if (activeTab === 'security') {
        if (formData.newPassword) {
          // SSO 계정은 현재 비밀번호 없이도 새 비밀번호 설정 가능
          const isSSOAccount = currentUser?.auth_provider !== 'local';
          
          if (!isSSOAccount && !formData.currentPassword) {
            showToast.error(t('profile.currentPasswordRequired'));
            return;
          }
          
          if (formData.newPassword.length < 6) {
            showToast.error(t('profile.passwordTooShort'));
            return;
          }
          
          if (formData.newPassword !== formData.confirmPassword) {
            showToast.error(t('auth.passwordsNotMatch'));
            return;
          }
          
          updateData.current_password = formData.currentPassword;
          updateData.new_password = formData.newPassword;
        }
      }
      
      // Check if there are any changes
      if (Object.keys(updateData).length === 0) {
        showToast.error(t('profile.noChanges'));
        return;
      }
      
      await updateCurrentUser(updateData);
      
      showToast.success(t('profile.accountUpdated'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update account:', error);
      
      // 에러 메시지 처리
      const errorDetail = error.response?.data?.detail;
      let errorMessage = t('profile.accountUpdateFailed');
      
      if (errorDetail === 'DISPLAY_NAME_TAKEN') {
        errorMessage = t('profile.displayNameTaken');
      } else if (errorDetail === 'DISPLAY_NAME_CONFLICTS_USERNAME') {
        errorMessage = t('profile.displayNameConflictsUsername');
      } else if (errorDetail && errorDetail.includes('Display name can only be changed')) {
        // Cooldown 에러 메시지 처리
        const match = errorDetail.match(/(\d+) days/);
        if (match) {
          const days = match[1];
          errorMessage = i18n.language === 'ko'
            ? `닉네임은 ${days}일마다 한 번만 변경할 수 있습니다`
            : `Display name can only be changed once every ${days} days`;
        } else {
          errorMessage = errorDetail;
        }
      } else if (errorDetail) {
        errorMessage = errorDetail;
      }
      
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDisplayName = async () => {
    try {
      setLoading(true);
      await updateCurrentUser({ display_name: '' });
      showToast.success(t('profile.displayNameCleared'));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to clear display name:', error);
      showToast.error(t('profile.displayNameUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-yt-light rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-yt-light z-10">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-yt-red" />
            <h2 className="text-xl font-bold">{t('profile.accountSettings')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yt-dark rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 overflow-x-auto">
          <div className="flex min-w-max">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm sm:text-base">{t('profile.profileTab')}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                activeTab === 'security'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Key className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm sm:text-base">{t('profile.securityTab')}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sso')}
              className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                activeTab === 'sso'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm sm:text-base">{t('profile.ssoTab') || 'SSO'}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('api-tokens')}
              className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                activeTab === 'api-tokens'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Code className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap text-sm sm:text-base">{t('apiTokens.tab')}</span>
              </div>
            </button>
            {/* Telegram Bot Tab - Only show if user has permission */}
            {currentUser?.permissions?.can_use_telegram_bot && (
              <button
                onClick={() => setActiveTab('telegram-bot')}
                className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                  activeTab === 'telegram-bot'
                    ? 'text-yt-red border-b-2 border-yt-red'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.155.232.171.326.016.094.036.308.02.475z"/>
                  </svg>
                  <span className="whitespace-nowrap text-sm sm:text-base">{t('telegramBot.tab') || '봇'}</span>
                </div>
              </button>
            )}
            {/* Folder Organization Tab */}
            <button
              onClick={() => setActiveTab('folder-organization')}
              className={`px-4 sm:px-6 py-3 font-medium transition-colors ${
                activeTab === 'folder-organization'
                  ? 'text-yt-red border-b-2 border-yt-red'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="whitespace-nowrap text-sm sm:text-base">{t('settings.system.folderOrganization')}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {activeTab === 'profile' && (
            <>
              {/* Current Info */}
              <div className="bg-yt-dark p-4 rounded-lg space-y-2">
                <div>
                  <p className="text-sm text-gray-400">{t('profile.username')}</p>
                  <p className="font-medium">{currentUser?.username}</p>
                </div>
                {currentUser?.auth_provider !== 'local' && (
                  <div>
                    <p className="text-sm text-gray-400">{t('profile.authProvider')}</p>
                    <p className="font-medium capitalize">{currentUser?.auth_provider}</p>
                  </div>
                )}
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profile.displayName')}
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
                  placeholder={t('profile.displayNamePlaceholder')}
                  maxLength={20}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    {t('profile.displayNameHint')}
                  </p>
                  {currentUser?.display_name && (
                    <button
                      type="button"
                      onClick={handleClearDisplayName}
                      disabled={loading}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      {t('profile.clearDisplayName')}
                    </button>
                  )}
                </div>
                {/* Cooldown warning */}
                {currentUser?.role !== 'super_admin' && (
                  <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs text-yellow-200">
                    ⚠️ {i18n.language === 'ko' 
                      ? `닉네임 변경은 ${cooldownDays}일에 1번 수정 가능합니다`
                      : `Display name can be changed once every ${cooldownDays} days`
                    }
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profile.email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!canChangeEmail}
                  className={`w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red ${
                    !canChangeEmail ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder={t('profile.emailPlaceholder')}
                />
                {!canChangeEmail && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t('profile.emailChangeDisabledSSO')}
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  💡 {currentUser?.auth_provider === 'local' 
                    ? t('profile.displayNameInfoLocal')
                    : t('profile.displayNameInfoSSO')}
                </p>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <>
              {/* SSO Account Info */}
              {currentUser?.auth_provider !== 'local' && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    ⚠️ {t('profile.ssoPasswordSetupInfo')}
                  </p>
                </div>
              )}
              
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profile.currentPassword')}
                  {currentUser?.auth_provider !== 'local' && (
                    <span className="text-xs text-gray-500 ml-2">({t('profile.optional')})</span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
                  placeholder={currentUser?.auth_provider !== 'local' 
                    ? t('profile.currentPasswordPlaceholderSSO')
                    : t('profile.currentPasswordPlaceholder')}
                />
                {currentUser?.auth_provider !== 'local' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t('profile.ssoPasswordHint')}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profile.newPassword')}
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
                  placeholder={t('profile.newPasswordPlaceholder')}
                  minLength={6}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('profile.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-yt-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yt-red"
                  placeholder={t('profile.confirmPasswordPlaceholder')}
                  minLength={6}
                />
              </div>

              {/* Info */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  💡 {t('profile.passwordInfo')}
                </p>
              </div>
            </>
          )}

          {activeTab === 'sso' && (
            <div className="space-y-4">
              {/* 현재 연동 상태 */}
              <div className="bg-yt-dark p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-3">{t('ssoAccount.currentStatus')}</h3>
                {currentUser?.auth_provider !== 'local' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yt-light rounded-lg flex items-center justify-center flex-shrink-0">
                        {(() => {
                          const Icon = providerIcons[currentUser.auth_provider] || Shield;
                          return <Icon />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {t(`auth.sso.${currentUser.auth_provider}`, currentUser.auth_provider)}
                        </p>
                        <p className="text-sm text-gray-400 truncate">
                          {currentUser?.email || t('ssoAccount.noEmail')}
                        </p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    </div>
                    <button
                      onClick={() => handleUnlinkSSO(currentUser.auth_provider)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
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
              {!currentUser || currentUser.auth_provider === 'local' ? (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">{t('ssoAccount.availableProviders')}</h3>
                  {loadingSSOProviders ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 mx-auto border-4 border-gray-600 border-t-yt-red rounded-full animate-spin"></div>
                      <p className="text-gray-400 mt-2">{t('ssoAccount.loading')}</p>
                    </div>
                  ) : ssoProviders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>{t('ssoAccount.noProviders')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ssoProviders.map((provider) => {
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
                              onClick={() => handleLinkSSO(provider.provider)}
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
              ) : null}

              {/* 안내 메시지 */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  💡 {t('ssoAccount.info')}
                </p>
              </div>

              {/* SSO 연동 해제 안내 */}
              {currentUser?.auth_provider !== 'local' && (
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
          )}

          {/* API Tokens Tab */}
          {activeTab === 'api-tokens' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  💡 {t('apiTokens.info')}
                </p>
              </div>

              {/* Create Token Button */}
              <button
                type="button"
                onClick={() => setShowCreateTokenModal(true)}
                className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('apiTokens.generateNew')}
              </button>

              {/* Tokens List */}
              {loadingTokens ? (
                <div className="text-center py-8 text-gray-400">
                  {t('common.loading')}
                </div>
              ) : apiTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {t('apiTokens.noTokens')}
                </div>
              ) : (
                <div className="space-y-3">
                  {apiTokens.map((token) => (
                    <div
                      key={token.id}
                      className="bg-yt-light rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{token.name}</h4>
                          <code className="text-sm text-gray-400 font-mono">
                            {token.token_prefix}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeToken(token.id, token.name)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title={t('apiTokens.revoke')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>
                          {t('apiTokens.created')}: {new Date(token.created_at).toLocaleString(i18n.language)}
                        </div>
                        {token.last_used_at && (
                          <div>
                            {t('apiTokens.lastUsed')}: {new Date(token.last_used_at).toLocaleString(i18n.language)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Telegram Bot Tab */}
          {activeTab === 'telegram-bot' && (
            <div className="space-y-4">
              {loadingBot ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yt-red mx-auto"></div>
                  <p className="text-gray-400 mt-4">{t('telegramBot.loading') || 'Loading...'}</p>
                </div>
              ) : botStatus ? (
                <>
                  {/* Bot Status */}
                  <div className="bg-yt-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{t('telegramBot.botStatusTitle')}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        botStatus.status === 'running' ? 'bg-green-600 text-white' :
                        botStatus.status === 'error' ? 'bg-red-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {botStatus.status === 'running' ? `🟢 ${t('telegramBot.status.running')}` :
                         botStatus.status === 'error' ? `🔴 ${t('telegramBot.status.error')}` :
                         `⚪ ${t('telegramBot.status.stopped')}`}
                      </span>
                    </div>
                    
                    {botStatus.error_message && (
                      <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
                        <p className="text-sm text-red-200">{botStatus.error_message}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">{t('telegramBot.mode.label')}</p>
                        <p className="text-white font-medium">{t(`telegramBot.mode.${botStatus.bot_mode}`)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{t('telegramBot.totalDownloads')}</p>
                        <p className="text-white font-medium">{botStatus.total_downloads}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{t('telegramBot.totalMessages')}</p>
                        <p className="text-white font-medium">{botStatus.total_messages}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{t('telegramBot.lastActive')}</p>
                        <p className="text-white font-medium">
                          {botStatus.last_active_at ? new Date(botStatus.last_active_at).toLocaleString(i18n.language) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bot Settings */}
                  <div className="bg-yt-dark rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">{t('telegramBot.settings') || 'Settings'}</h3>
                    
                    <div className="space-y-4">
                      {/* Bot Mode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('telegramBot.botMode') || 'Bot Mode'}
                        </label>
                        <select
                          value={botMode}
                          onChange={(e) => setBotMode(e.target.value)}
                          className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="button">{t('telegramBot.buttonMode') || 'Button Mode'}</option>
                          <option value="best">{t('telegramBot.bestMode') || 'Best Mode'}</option>
                          <option value="mp3">{t('telegramBot.mp3Mode') || 'MP3 Mode'}</option>
                        </select>
                      </div>

                      {/* Notifications */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notificationsEnabled}
                            onChange={(e) => setNotificationsEnabled(e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{t('telegramBot.enableNotifications') || 'Enable notifications'}</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={progressNotifications}
                            onChange={(e) => setProgressNotifications(e.target.checked)}
                            disabled={!notificationsEnabled}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{t('telegramBot.enableProgressNotifications') || 'Progress notifications'}</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateBot}
                      disabled={loadingBot}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {t('telegramBot.updateSettings') || 'Update Settings'}
                    </button>
                  </div>

                  {/* Bot Controls */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {botStatus.status === 'running' ? (
                        <button
                          type="button"
                          onClick={handleStopBot}
                          disabled={loadingBot}
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {t('telegramBot.stop') || 'Stop Bot'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartBot}
                          disabled={loadingBot}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {t('telegramBot.start') || 'Start Bot'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowDeleteBotModal(true)}
                        disabled={loadingBot}
                        className="px-6 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                    
                    {/* Chat ID Reset Button */}
                    <button
                      type="button"
                      onClick={handleResetChatId}
                      disabled={loadingBot}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {t('telegramBot.resetChatId') || '🔄 Reset Chat ID (Change Telegram Account)'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Setup Bot */}
                  <div className="bg-yt-dark rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4">{t('telegramBot.setup') || 'Setup Telegram Bot'}</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('telegramBot.botToken') || 'Bot Token'}
                        </label>
                        <input
                          type="password"
                          value={botToken}
                          onChange={(e) => setBotToken(e.target.value)}
                          placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                          className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('telegramBot.botMode') || 'Bot Mode'}
                        </label>
                        <select
                          value={botMode}
                          onChange={(e) => setBotMode(e.target.value)}
                          className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="button">{t('telegramBot.buttonMode') || 'Button Mode'}</option>
                          <option value="best">{t('telegramBot.bestMode') || 'Best Mode'}</option>
                          <option value="mp3">{t('telegramBot.mp3Mode') || 'MP3 Mode'}</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notificationsEnabled}
                            onChange={(e) => setNotificationsEnabled(e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{t('telegramBot.enableNotifications') || 'Enable notifications'}</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={handleTestBot}
                        disabled={testingBot || !botToken.trim()}
                        className="px-6 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {testingBot ? t('telegramBot.testing') || 'Testing...' : t('telegramBot.test') || 'Test'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSetupBot}
                        disabled={loadingBot || !botToken.trim()}
                        className="flex-1 bg-yt-red hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {t('telegramBot.setupBot') || 'Setup Bot'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Folder Organization Tab */}
          {activeTab === 'folder-organization' && (
            <div className="space-y-4">
              {loadingFolderSettings ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yt-red mx-auto"></div>
                  <p className="text-gray-400 mt-4">{t('common.loading')}</p>
                </div>
              ) : (
                <>
                  {/* Info */}
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <p className="text-sm text-blue-200">
                      💡 {t('settings.system.folderOrganizationInfo')}
                    </p>
                  </div>

                  {/* Two-Step Folder Selection */}
                  <div className="space-y-4">
                    {/* First Level Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('settings.system.firstLevelFolder')}
                      </label>
                      <select
                        value={firstLevel}
                        onChange={(e) => handleFirstLevelChange(e.target.value)}
                        className="w-full bg-yt-light text-white rounded-lg p-3 border border-gray-700 focus:border-yt-red focus:outline-none"
                      >
                        <option value="none">{t('settings.system.folderMode.none')}</option>
                        <option value="date">{t('settings.system.folderMode.date')}</option>
                        <option value="site_full">{t('settings.system.folderMode.siteFull')}</option>
                        <option value="site_name">{t('settings.system.folderMode.siteName')}</option>
                      </select>
                    </div>

                    {/* Second Level Selection (conditional) */}
                    {firstLevel !== 'none' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('settings.system.secondLevelFolder')}
                        </label>
                        <select
                          value={secondLevel}
                          onChange={(e) => setSecondLevel(e.target.value)}
                          className="w-full bg-yt-light text-white rounded-lg p-3 border border-gray-700 focus:border-yt-red focus:outline-none"
                        >
                          <option value="none">{t('settings.system.folderMode.none')}</option>
                          {getSecondLevelOptions(firstLevel).map(option => (
                            <option key={option} value={option}>
                              {t(`settings.system.folderMode.${toCamelCase(option)}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="bg-yt-dark rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      {t('settings.system.folderPreview')}
                    </h4>
                    <div className="text-sm text-gray-400 font-mono bg-yt-darker px-3 py-2 rounded">
                      {t('settings.system.folderPreviewExample', { path: getFolderPreview(combineFolderMode(firstLevel, secondLevel)) })}
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveFolderOrganization}
                    disabled={loadingFolderSettings}
                    className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{loadingFolderSettings ? t('profile.saving') : t('profile.saveChanges')}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          {activeTab !== 'sso' && activeTab !== 'api-tokens' && activeTab !== 'telegram-bot' && activeTab !== 'folder-organization' && (
            <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              {t('profile.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-yt-red hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? t('profile.saving') : t('profile.saveChanges')}</span>
            </button>
          </div>
          )}
        </form>
      </div>

      {/* 토큰 생성 모달 */}
      {showCreateTokenModal && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <div className="bg-yt-dark rounded-lg w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-bold mb-4">{t('apiTokens.createTitle')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {t('apiTokens.createDescription')}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('apiTokens.tokenName')}
              </label>
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder={t('apiTokens.tokenNamePlaceholder')}
                className="w-full bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                maxLength={100}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateToken}
                disabled={!newTokenName.trim()}
                className="flex-1 bg-yt-red hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('apiTokens.create')}
              </button>
              <button
                onClick={() => {
                  setShowCreateTokenModal(false);
                  setNewTokenName('');
                }}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성된 토큰 표시 모달 */}
      {createdToken && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <div className="bg-yt-dark rounded-lg w-full max-w-2xl p-6 m-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-yellow-500">{t('apiTokens.tokenCreatedTitle')}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {t('apiTokens.tokenCreatedWarning')}
                </p>
              </div>
            </div>

            {/* 방법 1: Config URL (가장 간편) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ⭐ {t('apiTokens.configUrl')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdToken.config_url}
                  readOnly
                  className="flex-1 bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => copyToClipboard(createdToken.config_url, t('apiTokens.configUrlCopied'))}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {t('apiTokens.copy')}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('apiTokens.configUrlDescription')}
              </p>
            </div>

            {/* 방법 2: API Token */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🔑 {t('apiTokens.apiToken')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdToken.token}
                  readOnly
                  className="flex-1 bg-yt-darker border border-gray-600 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => copyToClipboard(createdToken.token, t('apiTokens.tokenCopied'))}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {t('apiTokens.copy')}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('apiTokens.apiTokenDescription')}
              </p>
            </div>

            {/* 사용 방법 안내 */}
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-blue-200 mb-2">
                📚 {t('apiTokens.usageGuide')}
              </h4>
              <div className="text-xs text-blue-200 space-y-2">
                <div>
                  <strong>⭐ {t('apiTokens.method1')}</strong> ({t('apiTokens.recommended')})
                  <div className="text-gray-300 mt-1">{t('apiTokens.method1Description')}</div>
                </div>
                <div>
                  <strong>🔑 {t('apiTokens.method2')}</strong>
                  <div className="text-gray-300 mt-1">{t('apiTokens.method2Description')}</div>
                </div>
                <div>
                  <strong>📝 {t('apiTokens.method3')}</strong> ({t('apiTokens.legacy')})
                  <div className="text-gray-300 mt-1">{t('apiTokens.method3Description')}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCreatedToken(null)}
              className="w-full bg-yt-red hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {t('apiTokens.close')}
            </button>
          </div>
        </div>
      )}

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

      {/* Delete Bot Confirmation Modal */}
      {showDeleteBotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-yt-dark rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{t('telegramBot.confirmDeleteTitle')}</h3>
            <p className="text-gray-300 mb-6">
              {t('telegramBot.confirmDelete')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteBotModal(false)}
                className="px-4 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={handleDeleteBot}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {t('modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
