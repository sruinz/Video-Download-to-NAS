import { X, CheckCircle, XCircle, Download, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DownloadProgressItem({ download, onDismiss, onRetry }) {
  const { t } = useTranslation();

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s';
    const mbps = bytesPerSec / (1024 * 1024);
    if (mbps >= 1) {
      return `${mbps.toFixed(2)} MB/s`;
    }
    const kbps = bytesPerSec / 1024;
    return `${kbps.toFixed(2)} KB/s`;
  };

  const formatETA = (seconds) => {
    if (!seconds || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const getStatusColor = () => {
    switch (download.status) {
      case 'downloading':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (download.status) {
      case 'downloading':
        return <Download className="w-4 h-4 animate-bounce" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-yt-light rounded-lg p-3 mb-2 border border-gray-800 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate" title={download.filename}>
              {download.filename || 'Preparing...'}
            </p>
            <p className="text-xs text-gray-400">
              {download.resolution}
              {download.file_size && ` • ${formatFileSize(download.file_size)}`}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          {download.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(download)}
              className="p-1 hover:bg-yt-dark rounded transition-colors"
              title={t('download.retry')}
            >
              <RotateCw className="w-4 h-4 text-gray-400 hover:text-yt-red" />
            </button>
          )}
          {(download.status === 'completed' || download.status === 'failed') && (
            <button
              onClick={() => onDismiss(download.id)}
              className="p-1 hover:bg-yt-dark rounded transition-colors"
              title={t('modal.close')}
            >
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {download.status === 'downloading' && (
        <>
          <div className="w-full h-2 bg-yt-dark rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-yt-red to-red-600 transition-all duration-300 ease-out"
              style={{ width: `${download.progress}%` }}
            />
          </div>
          
          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{download.progress.toFixed(1)}%</span>
            <div className="flex items-center gap-3">
              <span>{formatSpeed(download.speed)}</span>
              <span>ETA: {formatETA(download.eta)}</span>
            </div>
          </div>
        </>
      )}

      {/* Error Message */}
      {download.status === 'failed' && download.error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-300">
          {download.error}
        </div>
      )}

      {/* Completed Message */}
      {download.status === 'completed' && (
        <div className="mt-2 text-xs text-green-400">
          ✓ Download completed successfully
        </div>
      )}
    </div>
  );
}
