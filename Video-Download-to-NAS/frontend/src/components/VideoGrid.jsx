import React from 'react';
import {
  Play,
  Download as DownloadIcon,
  Trash2,
  FileVideo,
  FileAudio,
  FileText,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  Edit2,
  Info,
  User,
  Calendar,
  X,
  Subtitles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileActions } from '../hooks/useFileActions';
import { extractDisplayFilename } from '../utils/folderTree';
import { formatSubtitleBadgeSummary, parseSubtitleInfo } from '../utils/subtitleUtils';

export default function VideoGrid({
  files,
  playlistFiles = null,
  onFileDeleted,
  onFileUpdated,
  currentUser,
  isPublicBoard = false
}) {
  const { t } = useTranslation();
  const {
    handlePlay,
    handleDownload,
    handleDelete,
    handleRename,
    handlePublishToggle,
    handleShowInfo,
    handleCreateShareLink,
    getThumbnailUrl,
    formatFileSize,
    formatDuration
  } = useFileActions({
    files,
    playlistFiles,
    onFileDeleted,
    onFileUpdated,
    currentUser,
    isPublicBoard
  });

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video':
        return <FileVideo className="w-12 h-12 text-yt-red" />;
      case 'audio':
        return <FileAudio className="w-12 h-12 text-blue-500" />;
      case 'subtitle':
        return <FileText className="w-12 h-12 text-green-500" />;
      default:
        return <FileVideo className="w-12 h-12 text-gray-500" />;
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <FileVideo className="w-24 h-24 mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl text-gray-400">{t('library.empty.title')}</h3>
        <p className="text-gray-500 mt-2">{t('library.empty.description')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {files.map((file) => {
        const displayName = isPublicBoard
          ? (file.public_title || extractDisplayFilename(file.filename))
          : extractDisplayFilename(file.filename);
        const isSubtitle = file.file_type === 'subtitle';
        const subtitleMeta = isSubtitle ? (file.subtitleMeta || parseSubtitleInfo(file.filename)) : null;
        const subtitleBadge = !isSubtitle && file.subtitles?.length
          ? formatSubtitleBadgeSummary(file.subtitles)
          : '';
        const thumbnailUrl = isSubtitle ? null : getThumbnailUrl(file);
        const canUnpublishPublic = isPublicBoard && currentUser && (
          file.uploader?.id === currentUser.id || currentUser.role === 'super_admin'
        );

        return (
          <div
            key={file.id}
            className={`rounded-lg overflow-hidden transition-colors group ${
              isPublicBoard ? 'bg-yt-light hover:bg-gray-700' : 'bg-yt-light hover:bg-yt-dark'
            }`}
          >
            {/* Thumbnail / Icon */}
            <div className={`aspect-video flex items-center justify-center relative ${
              isSubtitle
                ? 'bg-gradient-to-br from-emerald-950/90 via-gray-900 to-gray-950'
                : 'bg-yt-dark'
            }`}>
              {isSubtitle ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center px-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Subtitles className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
                      {subtitleMeta?.format || 'SRT'}
                    </span>
                    {subtitleMeta?.lang && (
                      <span className="px-2 py-0.5 rounded bg-gray-800/90 border border-gray-600 text-gray-200 text-xs font-semibold">
                        {subtitleMeta.shortLabel}
                      </span>
                    )}
                  </div>
                </div>
              ) : thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={displayName}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                getFileIcon(file.file_type)
              )}

              {/* Public board unpublish button on hover */}
              {canUnpublishPublic && (
                <button
                  type="button"
                  onClick={() => handlePublishToggle(file)}
                  className="absolute top-2 left-2 p-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                  title={t('publicBoard.unpublish')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Resolution badge */}
              {file.file_type === 'video' && file.resolution && (
                <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold">
                  {file.resolution}
                </div>
              )}

              {/* Attached Subtitles CC badge */}
              {subtitleBadge && (
                <div
                  className="absolute bottom-2 left-2 bg-emerald-600/90 text-white px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1 shadow"
                  title={t('subtitles.badgeTooltip', { langs: file.subtitles.map((s) => s.shortLabel).join(', ') })}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span>{subtitleBadge}</span>
                </div>
              )}

              {/* Duration badge */}
              {!isSubtitle && file.duration && (
                <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold">
                  {formatDuration(file.duration)}
                </div>
              )}

              {/* Hover overlay - Main actions */}
              <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                {(file.file_type === 'video' || file.file_type === 'audio') && (
                  <button
                    type="button"
                    onClick={() => handlePlay(file)}
                    className="p-3 sm:p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    title={t('file.play')}
                  >
                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}

                {isPublicBoard ? (
                  <>
                    {file.original_url && (
                      <a
                        href={file.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 sm:p-4 bg-blue-600/60 hover:bg-blue-600/80 rounded-full transition-colors"
                        title={t('file.openOriginal')}
                      >
                        <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-3 sm:p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                      title={t('file.download')}
                    >
                      <DownloadIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </>
                ) : (
                  <>
                    {currentUser?.permissions?.can_download_from_nas && (
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        className="p-3 sm:p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        title={t('file.download')}
                      >
                        <DownloadIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(file)}
                      className="p-3 sm:p-4 bg-red-600/60 hover:bg-red-600/80 rounded-full transition-colors"
                      title={t('file.delete')}
                    >
                      <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="p-3 sm:p-4">
              <h3 className="font-semibold text-sm line-clamp-2 mb-2 break-words" title={file.filename}>
                {displayName}
              </h3>

              {isPublicBoard && file.public_description && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                  {file.public_description}
                </p>
              )}

              {isPublicBoard ? (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-400 gap-2 mb-1">
                    <div className="flex items-center gap-1 truncate">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{file.uploader?.username}</span>
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
                    <span>{t(`file.${file.file_type}`)}</span>
                    <span>{formatFileSize(file.file_size)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-400 gap-2 mb-2">
                    <span className="truncate">{t(`file.${file.file_type}`)}</span>
                    <span className="whitespace-nowrap">{formatFileSize(file.file_size)}</span>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleShowInfo(file)}
                        className="p-1.5 text-gray-400 hover:bg-gray-600/20 rounded transition-colors"
                        title={t('file.info')}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRename(file)}
                        className="p-1.5 text-gray-400 hover:bg-gray-600/20 rounded transition-colors"
                        title={t('file.rename')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {file.original_url && (
                        <a
                          href={file.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-400 hover:bg-blue-600/20 rounded transition-colors"
                          title={t('file.openOriginal')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {currentUser?.permissions?.can_post_to_public_board && (
                        <button
                          type="button"
                          onClick={() => handlePublishToggle(file)}
                          className={`p-1.5 rounded transition-colors ${
                            file.is_public
                              ? 'text-green-400 hover:bg-green-600/20'
                              : 'text-purple-400 hover:bg-purple-600/20'
                          }`}
                          title={file.is_public ? t('publicBoard.unpublish') : t('publicBoard.publish')}
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {currentUser?.permissions?.can_create_share_links && (
                        <button
                          type="button"
                          onClick={() => handleCreateShareLink(file)}
                          className="p-1.5 text-yellow-400 hover:bg-yellow-600/20 rounded transition-colors"
                          title={t('shareLinks.create')}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
