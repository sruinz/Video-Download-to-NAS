import React, { useState } from 'react';
import { Download, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { startDownload } from '../api';
import showToast from '../utils/toast';

export default function DownloadForm({ onDownloadStart, currentUser }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [resolution, setResolution] = useState('best');
  const [loading, setLoading] = useState(false);

  // Check if user has download permission
  const canDownload = currentUser?.permissions?.can_download_to_nas;

  const resolutions = [
    { value: 'best', label: t('resolution.best') },
    { value: '2160p', label: t('resolution.2160p') },
    { value: '1440p', label: t('resolution.1440p') },
    { value: '1080p', label: t('resolution.1080p') },
    { value: '720p', label: t('resolution.720p') },
    { value: '480p', label: t('resolution.480p') },
    { value: '360p', label: t('resolution.360p') },
    { value: 'audio-m4a', label: t('resolution.audioM4a') },
    { value: 'audio-mp3', label: t('resolution.audioMp3') },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      const result = await startDownload(url, resolution);
      onDownloadStart(result);
      setUrl('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      showToast.error(t('download.failed', { error: errorMsg }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yt-light rounded-lg p-4 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center">
          <Download className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-yt-red flex-shrink-0" />
          <span className="truncate">{t('download.title')}</span>
        </h2>
      </div>

      {!canDownload ? (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-center">
          <p className="text-red-400">다운로드 권한이 없습니다. 관리자에게 문의하세요.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Mobile: Stack vertically */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('download.pasteUrl')}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-yt-dark border border-gray-700 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yt-red"
                required
              />
            </div>

            <div className="flex gap-2 sm:gap-3">
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-3 bg-yt-dark border border-gray-700 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yt-red"
              >
                {resolutions.map((res) => (
                  <option key={res.value} value={res.value}>
                    {res.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 bg-yt-red hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap"
              >
                {loading ? t('download.starting') : t('download.download')}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
