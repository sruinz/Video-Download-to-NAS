import React from 'react';
import { X, Film, Music, Gauge, Zap, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function VideoInfoModal({ file, onClose }) {
  const { t } = useTranslation();

  if (!file) return null;

  const formatFileSize = (bytes) => {
    if (!bytes) return t('file.unknown');
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return t('file.unknown');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const MetadataRow = ({ icon: Icon, label, value }) => {
    if (!value) return null;
    
    return (
      <div className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
        <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-xs text-gray-400">{label}</div>
          <div className="text-sm font-medium">{value}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-yt-dark rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">{t('videoInfo.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yt-light rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Thumbnail */}
          {file.thumbnail && (
            <div className="mb-4 rounded-lg overflow-hidden bg-yt-darker">
              <img
                src={
                  file.thumbnail.startsWith('http')
                    ? file.thumbnail
                    : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`
                }
                alt={file.filename}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Filename */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">{t('videoInfo.filename')}</div>
            <div className="text-sm font-medium break-all">{file.filename.split('/').pop()}</div>
          </div>

          {/* Basic Info */}
          <div className="bg-yt-darker rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.basicInfo')}</h3>
            <div className="space-y-2">
              <MetadataRow
                icon={Film}
                label={t('videoInfo.fileType')}
                value={t(`file.${file.file_type}`)}
              />
              <MetadataRow
                icon={Gauge}
                label={t('videoInfo.fileSize')}
                value={formatFileSize(file.file_size)}
              />
              {file.duration && (
                <MetadataRow
                  icon={Zap}
                  label={t('videoInfo.duration')}
                  value={formatDuration(file.duration)}
                />
              )}
            </div>
          </div>

          {/* Video Metadata */}
          {file.file_type === 'video' && (file.resolution || file.video_codec || file.framerate) && (
            <div className="bg-yt-darker rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.videoMetadata')}</h3>
              <div className="space-y-2">
                <MetadataRow
                  icon={Monitor}
                  label={t('videoInfo.resolution')}
                  value={file.resolution}
                />
                <MetadataRow
                  icon={Film}
                  label={t('videoInfo.videoCodec')}
                  value={file.video_codec?.toUpperCase()}
                />
                <MetadataRow
                  icon={Zap}
                  label={t('videoInfo.framerate')}
                  value={file.framerate ? `${file.framerate} fps` : null}
                />
              </div>
            </div>
          )}

          {/* Audio Metadata */}
          {(file.audio_codec || file.bitrate) && (
            <div className="bg-yt-darker rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-300">{t('videoInfo.audioMetadata')}</h3>
              <div className="space-y-2">
                <MetadataRow
                  icon={Music}
                  label={t('videoInfo.audioCodec')}
                  value={file.audio_codec?.toUpperCase()}
                />
                <MetadataRow
                  icon={Gauge}
                  label={t('videoInfo.bitrate')}
                  value={file.bitrate ? `${file.bitrate}bps` : null}
                />
              </div>
            </div>
          )}

          {/* Original URL */}
          {file.original_url && (
            <div className="bg-yt-darker rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-300">{t('videoInfo.originalUrl')}</h3>
              <a
                href={file.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 break-all"
              >
                {file.original_url}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-yt-light hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {t('modal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
