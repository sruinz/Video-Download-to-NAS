import { useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '../contexts/WebSocketContext';
import DownloadProgressItem from './DownloadProgressItem';

export default function DownloadQueue() {
  const { t } = useTranslation();
  const { downloads, isConnected, isReconnecting, removeDownload } = useWebSocket();
  const [isExpanded, setIsExpanded] = useState(true);

  console.log('[DownloadQueue] downloads:', downloads.length, 'connected:', isConnected);

  // Show if there are downloads OR if not connected (to show connection status)
  if (downloads.length === 0 && isConnected) {
    console.log('[DownloadQueue] Hiding - no downloads and connected');
    return null;
  }

  const activeDownloads = downloads.filter(d => d.status === 'downloading');
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const failedDownloads = downloads.filter(d => d.status === 'failed');

  const handleRetry = (download) => {
    // TODO: Implement retry functionality
    console.log('Retry download:', download);
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] z-40">
      {/* Header */}
      <div
        className="bg-yt-dark border border-gray-800 rounded-t-lg p-3 cursor-pointer hover:bg-yt-light transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-yt-red" />
            <span className="font-medium text-white">
              {t('download.queue')} ({downloads.length})
            </span>
            {isReconnecting && (
              <span className="text-xs text-yellow-400">Reconnecting...</span>
            )}
            {!isConnected && !isReconnecting && (
              <span className="text-xs text-gray-500">Offline</span>
            )}
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Summary when collapsed */}
        {!isExpanded && activeDownloads.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            {activeDownloads.length} downloading
            {completedDownloads.length > 0 && `, ${completedDownloads.length} completed`}
            {failedDownloads.length > 0 && `, ${failedDownloads.length} failed`}
          </div>
        )}
      </div>

      {/* Download List */}
      {isExpanded && (
        <div className="bg-yt-dark border-x border-b border-gray-800 rounded-b-lg p-3 max-h-96 overflow-y-auto">
          {/* Connection Status */}
          {!isConnected && (
            <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-800 rounded text-xs text-yellow-300">
              {isReconnecting
                ? 'Reconnecting to server...'
                : 'Connection lost. Real-time updates unavailable.'}
            </div>
          )}

          {/* Active Downloads */}
          {activeDownloads.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase">
                Downloading ({activeDownloads.length})
              </h4>
              {activeDownloads.map((download) => (
                <DownloadProgressItem
                  key={download.id}
                  download={download}
                  onDismiss={removeDownload}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}

          {/* Completed Downloads */}
          {completedDownloads.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase">
                Completed ({completedDownloads.length})
              </h4>
              {completedDownloads.map((download) => (
                <DownloadProgressItem
                  key={download.id}
                  download={download}
                  onDismiss={removeDownload}
                />
              ))}
            </div>
          )}

          {/* Failed Downloads */}
          {failedDownloads.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase">
                Failed ({failedDownloads.length})
              </h4>
              {failedDownloads.map((download) => (
                <DownloadProgressItem
                  key={download.id}
                  download={download}
                  onDismiss={removeDownload}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No active downloads
            </div>
          )}
        </div>
      )}
    </div>
  );
}
