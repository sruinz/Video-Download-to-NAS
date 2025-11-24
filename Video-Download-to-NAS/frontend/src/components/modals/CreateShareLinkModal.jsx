import React, { useState } from 'react';
import { X, Link as LinkIcon, Lock, Clock, Eye, Download, Users, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createAdvancedShareLink } from '../../api';
import showToast from '../../utils/toast';

export default function CreateShareLinkModal({ isOpen, onClose, file, currentUser }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(file?.filename?.split('/').pop() || '');
  const [password, setPassword] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const data = {
        file_id: file.id,
        title: title || null,
        password: password || null,
        expires_in_hours: expiresInHours ? parseInt(expiresInHours) : null,
        max_views: maxViews ? parseInt(maxViews) : null,
        allow_download: allowDownload,
        allow_anonymous: allowAnonymous
      };
      
      const result = await createAdvancedShareLink(data);
      setCreatedLink(result);
      showToast.success(t('createShareLink.success'));
    } catch (error) {
      showToast.error(t('createShareLink.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const fullUrl = `${window.location.origin}${createdLink.url}`;
    
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
      
      setCopied(true);
      showToast.success(t('shareLinks.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      showToast.error(t('shareLinks.copyFailed'));
    }
  };

  const handleClose = () => {
    setCreatedLink(null);
    setTitle(file?.filename?.split('/').pop() || '');
    setPassword('');
    setExpiresInHours('');
    setMaxViews('');
    setAllowDownload(false);
    setAllowAnonymous(false);
    setCopied(false);
    onClose();
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-yt-light rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-yt-light">
          <div className="flex items-center gap-3">
            <LinkIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">{t('createShareLink.title')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {createdLink ? (
            /* Success View */
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-300 mb-2">{t('createShareLink.success')}</h3>
                    <div className="bg-yt-dark border border-green-700 rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-400 mb-2">{t('createShareLink.shareLink')}</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-gray-800 text-blue-300 px-3 py-2 rounded border border-gray-700 break-all">
                          {window.location.origin}{createdLink.url}
                        </code>
                        <button
                          onClick={handleCopyLink}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                          title={t('createShareLink.copy')}
                        >
                          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-300">
                      {createdLink.expires_at && (
                        <p>• {t('createShareLink.expires')}: {new Date(createdLink.expires_at).toLocaleString()}</p>
                      )}
                      {createdLink.max_views && (
                        <p>• {t('createShareLink.maxViews')}: {createdLink.max_views} {t('createShareLink.views')}</p>
                      )}
                      {createdLink.allow_download && (
                        <p>• {t('createShareLink.allowDownload')}</p>
                      )}
                      {createdLink.allow_anonymous && (
                        <p>• {t('createShareLink.allowAnonymous')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('createShareLink.close')}
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Info */}
              <div className="bg-yt-dark border border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">{t('createShareLink.fileToShare')}</p>
                <p className="font-medium text-white">{file.filename.split('/').pop()}</p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('createShareLink.titleLabel')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-yt-dark border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500"
                  placeholder={t('createShareLink.titlePlaceholder')}
                />
              </div>

              {/* Password */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Lock className="w-4 h-4" />
                  {t('createShareLink.passwordLabel')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-yt-dark border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500"
                  placeholder={t('createShareLink.passwordPlaceholder')}
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Clock className="w-4 h-4" />
                  {t('createShareLink.expiresLabel')}
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full px-3 py-2 bg-yt-dark border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                >
                  <option value="">{t('createShareLink.never')}</option>
                  <option value="1">1 {t('createShareLink.hours')}</option>
                  <option value="6">6 {t('createShareLink.hours')}</option>
                  <option value="24">24 {t('createShareLink.hours')}</option>
                  <option value="72">3 {t('createShareLink.days')}</option>
                  <option value="168">7 {t('createShareLink.days')}</option>
                  <option value="720">30 {t('createShareLink.days')}</option>
                </select>
              </div>

              {/* Max Views */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Eye className="w-4 h-4" />
                  {t('createShareLink.maxViewsLabel')}
                </label>
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-yt-dark border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500"
                  placeholder={t('createShareLink.maxViewsPlaceholder')}
                />
              </div>

              {/* Allow Download */}
              {currentUser?.permissions?.can_download_from_nas && (
                <div className="flex items-center gap-3 p-3 bg-yt-dark rounded-lg border border-gray-700">
                  <input
                    type="checkbox"
                    id="allowDownload"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="allowDownload" className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <Download className="w-4 h-4" />
                    {t('createShareLink.allowDownload')}
                  </label>
                </div>
              )}

              {/* Allow Anonymous */}
              <div className="flex items-center gap-3 p-3 bg-yt-dark rounded-lg border border-gray-700">
                <input
                  type="checkbox"
                  id="allowAnonymous"
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="allowAnonymous" className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <Users className="w-4 h-4" />
                  {t('createShareLink.allowAnonymous')}
                </label>
              </div>

              {/* Info */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  {t('createShareLink.infoDescription')}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? t('createShareLink.submitting') : t('createShareLink.submit')}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {t('modal.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
