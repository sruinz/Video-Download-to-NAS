import React, { useState, useEffect, useMemo } from 'react';
import { Video, Globe, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import Register from './components/Register';
import DownloadForm from './components/DownloadForm';
import VideoGrid from './components/VideoGrid';
import LibraryFilters from './components/LibraryFilters';
import Settings from './pages/Settings';
import PublicBoard from './pages/PublicBoard';
import ShareLinksManagement from './pages/ShareLinksManagement';
import ShareLinkAccess from './pages/ShareLinkAccess';
import SSOCallback from './pages/SSOCallback';
import SSOSetupGuide from './pages/SSOSetupGuide';
import TelegramBotManagement from './pages/TelegramBotManagement';
import RolePermissionsManagement from './pages/RolePermissionsManagement';
import ExtensionLinksModal from './components/modals/ExtensionLinksModal';
import DownloadQueue from './components/DownloadQueue';
import ConnectionStatus from './components/ConnectionStatus';
import UserProfileMenu from './components/UserProfileMenu';
import UpdateBanner from './components/UpdateBanner';
import { login, register, getLibrary, getCurrentUser, getPublicSettings } from './api';
import showToast from './utils/toast';
import { ModalProvider } from './contexts/ModalContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { useVersionCheck } from './hooks/useVersionCheck';

function App() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPublicBoard, setShowPublicBoard] = useState(false);
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [showSSOGuide, setShowSSOGuide] = useState(false);
  const [showTelegramBotManagement, setShowTelegramBotManagement] = useState(false);
  const [showRolePermissions, setShowRolePermissions] = useState(false);
  const [settingsTab, setSettingsTab] = useState('overview');
  const [settingsUserFilter, setSettingsUserFilter] = useState('all');
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  // Version check (관리자만)
  const { 
    currentVersion, 
    updateAvailable,
    dockerhubUpdateTime,
    showBanner, 
    dismissBanner 
  } = useVersionCheck(currentUser?.role);

  useEffect(() => {
    // Check if this is a share link
    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      // This is handled separately, don't auto-login
      return;
    }

    // Check for SSO token in URL parameters
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      // Store token from SSO callback
      localStorage.setItem('token', urlToken);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Set authenticated and load user data
      setIsAuthenticated(true);
      const loadUserData = async () => {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
          await loadLibrary();
          showToast.success(t('auth.loginSuccess'));
        } catch (error) {
          console.error('Failed to load user data after SSO:', error);
          showToast.error(t('auth.loginFailed'));
          handleLogout();
        }
      };
      loadUserData();
      return;
    }

    // Load registration setting (without auth)
    const loadSettings = async () => {
      try {
        const settings = await getPublicSettings();
        setAllowRegistration(settings.allow_registration !== false);
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Default to true if settings can't be loaded
        setAllowRegistration(true);
      }
    };
    loadSettings();

    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Load user info and library
      const loadUserData = async () => {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
          await loadLibrary();
        } catch (error) {
          console.error('Failed to load user data:', error);
          handleLogout();
        }
      };
      loadUserData();
    }
  }, []);

  const handleLogin = async (id, password) => {
    const data = await login(id, password);
    localStorage.setItem('token', data.access_token);
    setIsAuthenticated(true);
    const user = await getCurrentUser();
    setCurrentUser(user);
    await loadLibrary();
    
    // Check if there's a return URL (from share link)
    const returnUrl = sessionStorage.getItem('returnUrl');
    if (returnUrl) {
      sessionStorage.removeItem('returnUrl');
      window.location.href = returnUrl;
    }
  };

  const handleRegister = async (userData) => {
    const user = await register(userData.username, userData.email, userData.password);
    return user;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setFiles([]);
  };

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const data = await getLibrary();
      setFiles(data);
    } catch (error) {
      console.error('Failed to load library:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStart = (result) => {
    const message = result.download_id 
      ? t('download.started', { id: result.download_id })
      : t('download.started', { id: 'N/A' });
    showToast.success(message);
    // Reload library after a few seconds to see the new file
    setTimeout(() => loadLibrary(), 5000);
  };

  const handleFileDeleted = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(file => 
        file.filename.toLowerCase().includes(query)
      );
    }

    // Apply file type filter
    if (fileTypeFilter !== 'all') {
      result = result.filter(file => file.file_type === fileTypeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return a.filename.localeCompare(b.filename);
        case 'name-desc':
          return b.filename.localeCompare(a.filename);
        case 'size-desc':
          return (b.file_size || 0) - (a.file_size || 0);
        case 'size-asc':
          return (a.file_size || 0) - (b.file_size || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, fileTypeFilter, sortBy]);

  // Check if this is a share link access
  const path = window.location.pathname;
  if (path.startsWith('/share/')) {
    const token = path.split('/share/')[1];
    return (
      <ModalProvider>
        <Toaster />
        <ShareLinkAccess token={token} />
      </ModalProvider>
    );
  }

  // Check if this is an SSO callback
  if (path === '/sso/callback') {
    return (
      <ModalProvider>
        <Toaster />
        <SSOCallback />
      </ModalProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ModalProvider>
        <Toaster />
        {showRegister ? (
          <Register 
            onRegister={handleRegister} 
            onBackToLogin={() => setShowRegister(false)} 
          />
        ) : (
          <Login 
            onLogin={handleLogin} 
            onShowRegister={allowRegistration ? () => setShowRegister(true) : null} 
          />
        )}
      </ModalProvider>
    );
  }

  if (showSSOGuide) {
    return (
      <ModalProvider>
        <Toaster />
        <SSOSetupGuide 
          onBack={() => {
            setShowSSOGuide(false);
            setShowSettings(true);
            setSettingsTab('sso'); // SSO 탭으로 돌아가기
          }}
        />
      </ModalProvider>
    );
  }

  if (showSettings) {
    return (
      <ModalProvider>
        <Toaster />
        <Settings 
          onBack={() => {
            setShowSettings(false);
            setSettingsTab('overview'); // 설정 닫을 때 초기화
            setSettingsUserFilter('all'); // 필터도 초기화
          }} 
          currentUser={currentUser}
          onLogout={handleLogout}
          initialTab={settingsTab}
          initialUserFilter={settingsUserFilter}
          onOpenShareLinks={() => {
            setShowSettings(false);
            setShowShareLinks(true);
          }}
          onOpenSSOGuide={() => {
            setShowSettings(false);
            setShowSSOGuide(true);
          }}
          onOpenTelegramBotManagement={() => {
            setShowSettings(false);
            setShowTelegramBotManagement(true);
          }}
          onOpenRolePermissions={() => {
            setShowSettings(false);
            setShowRolePermissions(true);
          }}
        />
      </ModalProvider>
    );
  }

  if (showPublicBoard) {
    return (
      <ModalProvider>
        <Toaster />
        <PublicBoard 
          onClose={() => setShowPublicBoard(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenShareLinks={() => {
            setShowPublicBoard(false);
            setShowShareLinks(true);
          }}
          onOpenSettings={() => {
            setShowPublicBoard(false);
            setShowSettings(true);
          }}
        />
      </ModalProvider>
    );
  }

  if (showShareLinks) {
    return (
      <ModalProvider>
        <Toaster />
        <ShareLinksManagement 
          onClose={() => setShowShareLinks(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={() => {
            setShowShareLinks(false);
            setShowSettings(true);
          }}
        />
      </ModalProvider>
    );
  }

  if (showTelegramBotManagement) {
    // Only super_admin can access
    if (currentUser?.role !== 'super_admin') {
      setShowTelegramBotManagement(false);
      showToast.error(t('auth.permissionDenied'));
      return null;
    }

    return (
      <ModalProvider>
        <Toaster />
        <TelegramBotManagement 
          onClose={() => {
            setShowTelegramBotManagement(false);
            setShowSettings(true);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={() => {
            setShowTelegramBotManagement(false);
            setShowSettings(true);
          }}
        />
      </ModalProvider>
    );
  }

  if (showRolePermissions) {
    return (
      <ModalProvider>
        <Toaster />
        <RolePermissionsManagement 
          onClose={() => {
            setShowRolePermissions(false);
            setShowSettings(true);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={() => {
            setShowRolePermissions(false);
            setShowSettings(true);
          }}
        />
      </ModalProvider>
    );
  }

  return (
    <ModalProvider>
      <WebSocketProvider onLibraryUpdate={loadLibrary}>
        <Toaster />
        <div className="min-h-screen bg-yt-darker flex flex-col">
      {/* Update Banner (관리자만) */}
      {showBanner && (
        <UpdateBanner
          currentVersion={currentVersion}
          onDismiss={dismissBanner}
        />
      )}
      
      {/* Header */}
      <header className="bg-yt-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Video className="w-6 h-6 sm:w-8 sm:h-8 text-yt-red flex-shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{t('app.title')}</h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {currentUser && (
                <UserProfileMenu 
                  currentUser={currentUser} 
                  onLogout={handleLogout} 
                  onOpenShareLinks={() => setShowShareLinks(true)}
                  onOpenSettings={(tab, filter) => {
                    if (tab) setSettingsTab(tab);
                    if (filter) setSettingsUserFilter(filter);
                    setShowSettings(true);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Download Form */}
        <div className="mb-6 sm:mb-8">
          <DownloadForm onDownloadStart={handleDownloadStart} currentUser={currentUser} />
        </div>

        {/* Library */}
        <div className="bg-yt-light rounded-lg p-4 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold truncate">{t('library.title')}</h2>
              {currentUser?.permissions?.can_view_public_board && (
                <button
                  onClick={() => setShowPublicBoard(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                  title={t('publicBoard.title')}
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('publicBoard.title')}</span>
                </button>
              )}
            </div>
            <span className="text-sm sm:text-base text-gray-400 whitespace-nowrap">
              {filteredAndSortedFiles.length === files.length 
                ? t('library.files', { count: files.length })
                : `${filteredAndSortedFiles.length} / ${files.length} 파일`
              }
            </span>
          </div>

          {/* Filters */}
          <LibraryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            fileTypeFilter={fileTypeFilter}
            onFileTypeChange={setFileTypeFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {loading && files.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-600 border-t-yt-red rounded-full animate-spin"></div>
              <p className="text-gray-400">{t('library.loading')}</p>
            </div>
          ) : filteredAndSortedFiles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400">검색 결과가 없습니다</p>
            </div>
          ) : (
            <VideoGrid 
              files={filteredAndSortedFiles} 
              onFileDeleted={handleFileDeleted}
              onFileUpdated={loadLibrary}
              currentUser={currentUser}
            />
          )}
        </div>
      </main>

      {/* Download Queue - Fixed position at bottom right */}
      <DownloadQueue />

      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="space-y-2">
            {/* Title with Version */}
            <p className="text-gray-400 text-base font-medium">
              {t('app.title')}
              {currentVersion && (
                <span className="text-gray-500 text-sm ml-2">
                  v{currentVersion}
                  {updateAvailable && (
                    <span className="inline-flex items-center px-2 py-0.5 ml-2 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-600/30">
                      {t('update.updateAvailable')}
                    </span>
                  )}
                </span>
              )}
            </p>
            
            {/* Extension Link */}
            <p className="text-gray-500 text-sm">
              <button
                onClick={() => setShowExtensionModal(true)}
                className="inline-flex items-center gap-1 text-yt-red hover:text-red-400 transition-colors"
                title={t('extension.getExtension')}
              >
                <span className="underline decoration-dotted">{t('extension.extensionProgram')}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </p>
            
            {/* Developer Info and Guide Link */}
            <p className="text-gray-500 text-sm">
              Developed by{' '}
              <a
                href="https://svrforum.com/article_series/dispArticle_seriesView?series_id=8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yt-red hover:text-red-400 transition-colors font-medium"
              >
                서버포럼 - 빨간물약
              </a>
              {' '}•{' '}
              <a
                href="https://svrforum.com/article_series/dispArticle_seriesView?series_id=8"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t('update.guide')}
              </a>
            </p>
          </div>
        </div>
      </footer>
      </div>

      {/* Extension Links Modal */}
      <ExtensionLinksModal 
        isOpen={showExtensionModal} 
        onClose={() => setShowExtensionModal(false)} 
      />

      {/* Download Queue */}
      <DownloadQueue />

      {/* Connection Status */}
      <ConnectionStatus />
      </WebSocketProvider>
    </ModalProvider>
  );
}

export default App;
