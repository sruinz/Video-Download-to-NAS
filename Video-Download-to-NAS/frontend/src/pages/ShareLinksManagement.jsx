import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Copy, Eye, Clock, Download, Users, Lock, ToggleLeft, ToggleRight, Trash2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMyAdvancedShareLinks, toggleAdvancedShareLink, deleteAdvancedShareLink, getAdvancedShareLinkStats } from '../api';
import showToast from '../utils/toast';
import UserProfileMenu from '../components/UserProfileMenu';
import { useModal } from '../contexts/ModalContext';

export default function ShareLinksManagement({ onClose, currentUser, onLogout, onOpenSettings }) {
  const { t, i18n } = useTranslation();
  const { showConfirmModal } = useModal();
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linksData, statsData] = await Promise.all([
        getMyAdvancedShareLinks(),
        getAdvancedShareLinkStats()
      ]);
      setLinks(linksData);
      setStats(statsData);
    } catch (error) {
      showToast.error(t('shareLinks.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (token) => {
    const fullUrl = `${window.location.origin}/share/${token}`;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = fullUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(token);
      showToast.success(t('shareLinks.linkCopied'));
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      showToast.error(t('shareLinks.copyFailed'));
    }
  };

  const handleToggle = async (linkId) => {
    try {
      await toggleAdvancedShareLink(linkId);
      showToast.success(t('shareLinks.toggleSuccess'));
      loadData();
    } catch (error) {
      showToast.error(t('shareLinks.toggleFailed'));
    }
  };

  const handleDelete = async (linkId) => {
    try {
      const confirmed = await showConfirmModal({
        title: t('shareLinks.delete'),
        message: t('shareLinks.deleteConfirm'),
        confirmText: t('modal.delete'),
        cancelText: t('modal.cancel'),
        danger: true
      });

      if (!confirmed) return;
      
      await deleteAdvancedShareLink(linkId);
      showToast.success(t('shareLinks.deleteSuccess'));
      loadData();
    } catch (error) {
      if (error.message !== 'User cancelled') {
        showToast.error(t('shareLinks.deleteFailed'));
      }
    }
  };

  const getStatusBadge = (link) => {
    if (!link.is_active) {
      return <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">{t('shareLinks.status.inactive')}</span>;
    }
    if (link.is_expired) {
      return <span className="px-2 py-1 bg-red-200 text-red-700 text-xs rounded">{t('shareLinks.status.expired')}</span>;
    }
    if (link.is_max_views_reached) {
      return <span className="px-2 py-1 bg-orange-200 text-orange-700 text-xs rounded">{t('shareLinks.status.maxViews')}</span>;
    }
    return <span className="px-2 py-1 bg-green-200 text-green-700 text-xs rounded">{t('shareLinks.status.active')}</span>;
  };

  return (
    <div className="min-h-screen bg-yt-dark text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <LinkIcon className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">{t('shareLinks.title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('shareLinks.backButton')}
              </button>
              <UserProfileMenu 
                currentUser={currentUser} 
                onLogout={onLogout}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </div>
          <p className="text-gray-400">{t('shareLinks.description')}</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-yt-light rounded-lg p-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-8 h-8 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 whitespace-nowrap">{t('shareLinks.stats.totalLinks')}</p>
                  <p className="text-2xl font-bold">{stats.total_links}</p>
                </div>
              </div>
            </div>
            <div className="bg-yt-light rounded-lg p-4">
              <div className="flex items-center gap-3">
                <ToggleRight className="w-8 h-8 text-green-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 whitespace-nowrap">{t('shareLinks.stats.activeLinks')}</p>
                  <p className="text-2xl font-bold">{stats.active_links}</p>
                </div>
              </div>
            </div>
            <div className="bg-yt-light rounded-lg p-4">
              <div className="flex items-center gap-3">
                <ToggleLeft className="w-8 h-8 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 whitespace-nowrap">{t('shareLinks.stats.inactiveLinks')}</p>
                  <p className="text-2xl font-bold">{stats.inactive_links}</p>
                </div>
              </div>
            </div>
            <div className="bg-yt-light rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Eye className="w-8 h-8 text-purple-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 whitespace-nowrap">{t('shareLinks.stats.totalViews')}</p>
                  <p className="text-2xl font-bold">{stats.total_views}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Links List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">{t('shareLinks.loading')}</p>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12 bg-yt-light rounded-lg">
            <LinkIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400">{t('shareLinks.empty')}</p>
            <p className="text-gray-500 mt-2">{t('shareLinks.emptyDescription')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => (
              <div key={link.id} className="bg-yt-light rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{link.title || link.file.filename}</h3>
                      {getStatusBadge(link)}
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      {t('shareLinks.file')}: {link.file.filename} • {link.file.file_type}
                    </p>
                    
                    {/* Link URL */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="flex-1 text-sm bg-yt-dark px-3 py-2 rounded border border-gray-600 break-all">
                        {window.location.origin}/share/{link.token}
                      </code>
                      <button
                        onClick={() => handleCopyLink(link.token)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                        title={t('shareLinks.copy')}
                      >
                        {copied === link.token ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Eye className="w-4 h-4" />
                        <span>{link.view_count}{link.max_views ? `/${link.max_views}` : ''} {t('shareLinks.views')}</span>
                      </div>
                      {link.expires_at && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(link.expires_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}</span>
                        </div>
                      )}
                      {link.has_password && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Lock className="w-4 h-4" />
                          <span>{t('shareLinks.hasPassword')}</span>
                        </div>
                      )}
                      {link.allow_download && (
                        <div className="flex items-center gap-2 text-green-400">
                          <Download className="w-4 h-4" />
                          <span>{t('shareLinks.allowDownload')}</span>
                        </div>
                      )}
                      {link.allow_anonymous && (
                        <div className="flex items-center gap-2 text-blue-400">
                          <Users className="w-4 h-4" />
                          <span>{t('shareLinks.allowAnonymous')}</span>
                        </div>
                      )}
                    </div>

                    {/* Warnings */}
                    {(link.is_expired || link.is_max_views_reached) && (
                      <div className="mt-3 flex items-start gap-2 p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-orange-300">
                          {link.is_expired && <p>• {t('shareLinks.warnings.expired')}</p>}
                          {link.is_max_views_reached && <p>• {t('shareLinks.warnings.maxViews')}</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(link.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        link.is_active 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                      title={link.is_active ? t('shareLinks.deactivate') : t('shareLinks.activate')}
                    >
                      {link.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title={t('shareLinks.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                  <span>{t('shareLinks.created')}: {new Date(link.created_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}</span>
                  {link.last_accessed_at && (
                    <span>{t('shareLinks.lastAccessed')}: {new Date(link.last_accessed_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
