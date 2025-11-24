import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Play, Download as DownloadIcon, ExternalLink, Eye, Clock, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accessAdvancedShareLink, getFileUrl } from '../api';
import { useModal } from '../contexts/ModalContext';
import showToast from '../utils/toast';

export default function ShareLinkAccess({ token: propToken }) {
  const token = propToken; // Use prop instead of useParams
  const { t, i18n } = useTranslation();
  const { showVideoPlayer } = useModal();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    loadShareLink();
  }, [token]);

  const loadShareLink = async (pwd = null) => {
    try {
      setLoading(true);
      setError(null);
      const data = await accessAdvancedShareLink(token, pwd);
      setShareData(data);
      setNeedsPassword(false);
    } catch (error) {
      if (error.message.includes('Password required')) {
        setNeedsPassword(true);
        setError(null);
      } else if (error.message.includes('Login required')) {
        setError(t('shareLinkAccess.loginRequired'));
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      showToast.error(t('shareLinkAccess.errors.passwordRequired'));
      return;
    }
    loadShareLink(password);
  };

  const handlePlay = () => {
    if (shareData?.file) {
      // Add share token and password to file object for video player
      const fileWithShareToken = {
        ...shareData.file,
        shareToken: token,
        sharePassword: password,  // Include password for streaming
        // Ensure thumbnail URL is properly formatted for share links
        thumbnail: shareData.file.thumbnail 
          ? (shareData.file.thumbnail.startsWith('http') 
              ? shareData.file.thumbnail 
              : `/api/share-links/thumbnail/${token}/${shareData.file.id}${password ? `?password=${encodeURIComponent(password)}` : ''}`)
          : null
      };
      showVideoPlayer(fileWithShareToken);
    }
  };

  const handleDownload = async () => {
    try {
      // 공유 링크를 통한 다운로드는 download=true 파라미터 추가
      const params = new URLSearchParams();
      if (password) {
        params.append('password', password);
      }
      params.append('download', 'true');
      
      const url = `/api/share-links/file/${token}/${shareData.file.id}?${params.toString()}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = shareData.file.filename.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast.error(t('shareLinkAccess.errors.downloadFailed'));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yt-dark flex items-center justify-center">
        {/* Language Toggle - Top Right */}
        <div className="fixed top-4 right-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            title={i18n.language === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === 'ko' ? 'EN' : '한국어'}</span>
          </button>
        </div>

        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white">{t('shareLinkAccess.loading')}</p>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-yt-dark flex items-center justify-center p-4">
        {/* Language Toggle - Top Right */}
        <div className="fixed top-4 right-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            title={i18n.language === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === 'ko' ? 'EN' : '한국어'}</span>
          </button>
        </div>

        <div className="bg-yt-light rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-8 h-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">{t('shareLinkAccess.passwordRequired')}</h2>
          </div>
          
          <p className="text-gray-400 mb-6">
            {t('shareLinkAccess.passwordDescription')}
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('shareLinkAccess.passwordPlaceholder')}
              className="w-full px-4 py-3 bg-yt-dark border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              {t('shareLinkAccess.confirm')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    const needsLogin = error.includes(t('shareLinkAccess.loginRequired'));
    
    return (
      <div className="min-h-screen bg-yt-dark flex items-center justify-center p-4">
        {/* Language Toggle - Top Right */}
        <div className="fixed top-4 right-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            title={i18n.language === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === 'ko' ? 'EN' : '한국어'}</span>
          </button>
        </div>

        <div className="bg-yt-light rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">{t('shareLinkAccess.accessDenied')}</h2>
              <p className="text-gray-400">{error}</p>
            </div>
          </div>
          
          {needsLogin && (
            <div className="mt-6">
              <button
                onClick={() => {
                  // Save current URL to return after login
                  sessionStorage.setItem('returnUrl', window.location.pathname);
                  window.location.href = '/';
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                {t('shareLinkAccess.goToLogin')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!shareData) {
    return null;
  }

  const { file, share_info } = shareData;

  return (
    <div className="min-h-screen bg-yt-dark">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Language Toggle - Top Right */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 bg-yt-light hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            title={i18n.language === 'ko' ? 'Switch to English' : '한국어로 전환'}
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === 'ko' ? 'EN' : '한국어'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{share_info.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{share_info.view_count}{share_info.max_views ? `/${share_info.max_views}` : ''} {t('shareLinkAccess.views')}</span>
            </div>
            {share_info.expires_at && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('shareLinkAccess.expires')}: {new Date(share_info.expires_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', { 
                  year: 'numeric',
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video Player / Thumbnail */}
        <div className="bg-yt-light rounded-lg overflow-hidden mb-6">
          <div className="relative aspect-video bg-gray-800 flex items-center justify-center">
            {file.thumbnail ? (
              <img
                src={
                  file.thumbnail.startsWith('http') 
                    ? file.thumbnail 
                    : `/api/share-links/thumbnail/${token}/${file.id}${password ? `?password=${encodeURIComponent(password)}` : ''}`
                }
                alt={share_info.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Play className="w-24 h-24 text-gray-600" />
            )}
            
            {file.duration && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-1 rounded">
                {formatDuration(file.duration)}
              </div>
            )}

            {/* Play Button Overlay */}
            {(file.file_type === 'video' || file.file_type === 'audio') && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 bg-black/40 hover:bg-black/50 transition-colors flex items-center justify-center group"
              >
                <div className="w-20 h-20 bg-white/90 group-hover:bg-white rounded-full flex items-center justify-center">
                  <Play className="w-10 h-10 text-gray-900 ml-1" />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* File Info */}
        <div className="bg-yt-light rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('shareLinkAccess.fileInfo')}</h2>
          <div className="space-y-2 text-gray-300">
            <p><span className="text-gray-500">{t('shareLinkAccess.filename')}:</span> {file.filename.split('/').pop()}</p>
            <p><span className="text-gray-500">{t('shareLinkAccess.fileType')}:</span> {file.file_type}</p>
            <p><span className="text-gray-500">{t('shareLinkAccess.fileSize')}:</span> {formatFileSize(file.file_size)}</p>
            {file.duration && (
              <p><span className="text-gray-500">{t('shareLinkAccess.duration')}:</span> {formatDuration(file.duration)}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {(file.file_type === 'video' || file.file_type === 'audio') && (
            <button
              onClick={handlePlay}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
            >
              <Play className="w-5 h-5" />
              {t('shareLinkAccess.play')}
            </button>
          )}
          
          {share_info.allow_download && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
            >
              <DownloadIcon className="w-5 h-5" />
              {t('shareLinkAccess.download')}
            </button>
          )}
          
          {file.original_url && (
            <a
              href={file.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
            >
              <ExternalLink className="w-5 h-5" />
              {t('shareLinkAccess.viewOriginal')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
