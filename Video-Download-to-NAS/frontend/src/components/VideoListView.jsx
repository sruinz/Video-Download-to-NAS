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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Folder,
  User,
  X,
  Subtitles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileActions } from '../hooks/useFileActions';
import { extractDisplayFilename, extractFolderPathString } from '../utils/folderTree';
import { formatSubtitleBadgeSummary, parseSubtitleInfo } from '../utils/subtitleUtils';

export default function VideoListView({
  files,
  playlistFiles = null,
  onFileDeleted,
  onFileUpdated,
  currentUser,
  sortBy,
  onSortChange,
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

  const handleHeaderSort = (field) => {
    if (!onSortChange) return;
    const ascKey = `${field}-asc`;
    const descKey = `${field}-desc`;
    if (sortBy === descKey) {
      onSortChange(ascKey);
    } else if (sortBy === ascKey) {
      onSortChange(descKey);
    } else {
      onSortChange(field === 'name' || field === 'type' ? ascKey : descKey);
    }
  };

  const renderSortIcon = (field) => {
    if (sortBy === `${field}-asc`) {
      return <ArrowUp className="w-3.5 h-3.5 text-yt-red" />;
    }
    if (sortBy === `${field}-desc`) {
      return <ArrowDown className="w-3.5 h-3.5 text-yt-red" />;
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 opacity-60 group-hover:opacity-100" />;
  };

  const getSmallFileIcon = (fileType) => {
    switch (fileType) {
      case 'video':
        return <FileVideo className="w-5 h-5 text-yt-red flex-shrink-0" />;
      case 'audio':
        return <FileAudio className="w-5 h-5 text-blue-500 flex-shrink-0" />;
      case 'subtitle':
        return <FileText className="w-5 h-5 text-green-500 flex-shrink-0" />;
      default:
        return <FileVideo className="w-5 h-5 text-gray-500 flex-shrink-0" />;
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
    <div className="bg-yt-dark rounded-lg border border-gray-700/80 overflow-hidden">
      {/* Classification Header Row (Desktop) */}
      <div
        className={`hidden lg:grid items-center gap-3 px-4 py-3 bg-gray-800/80 border-b border-gray-700 text-xs font-semibold text-gray-300 select-none ${
          isPublicBoard
            ? 'grid-cols-[minmax(0,1fr)_120px_96px_96px_110px_140px]'
            : 'grid-cols-[minmax(0,1fr)_110px_96px_110px_250px]'
        }`}
      >
        <button
          type="button"
          onClick={() => handleHeaderSort('name')}
          className="group flex items-center gap-1.5 text-left hover:text-white transition-colors"
        >
          <span>{t('list.header.name')}</span>
          {renderSortIcon('name')}
        </button>

        {isPublicBoard && (
          <div className="text-left text-gray-400">{t('list.header.uploader')}</div>
        )}

        <button
          type="button"
          onClick={() => handleHeaderSort('type')}
          className="group flex items-center gap-1.5 text-left hover:text-white transition-colors"
        >
          <span>{t('list.header.type')}</span>
          {renderSortIcon('type')}
        </button>

        <button
          type="button"
          onClick={() => handleHeaderSort('size')}
          className="group flex items-center justify-end gap-1.5 text-right hover:text-white transition-colors"
        >
          <span>{t('list.header.size')}</span>
          {renderSortIcon('size')}
        </button>

        <button
          type="button"
          onClick={() => handleHeaderSort('date')}
          className="group flex items-center justify-end gap-1.5 text-right hover:text-white transition-colors"
        >
          <span>{t('list.header.date')}</span>
          {renderSortIcon('date')}
        </button>

        <div className="text-right text-gray-400">{t('list.header.actions')}</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-800">
        {files.map((file) => {
          const displayName = isPublicBoard
            ? (file.public_title || extractDisplayFilename(file.filename))
            : extractDisplayFilename(file.filename);
          const folderPath = !isPublicBoard
            ? extractFolderPathString(file.filename, currentUser?.username)
            : '';
          const isSubtitle = file.file_type === 'subtitle';
          const subtitleMeta = isSubtitle ? (file.subtitleMeta || parseSubtitleInfo(file.filename)) : null;
          const subtitleBadge = !isSubtitle && file.subtitles?.length
            ? formatSubtitleBadgeSummary(file.subtitles)
            : '';
          const thumbnailUrl = isSubtitle ? null : getThumbnailUrl(file);
          const isPlayable = file.file_type === 'video' || file.file_type === 'audio';
          const canUnpublishPublic = isPublicBoard && currentUser && (
            file.uploader?.id === currentUser.id || currentUser.role === 'super_admin'
          );

          return (
            <div
              key={file.id}
              className={`px-3 sm:px-4 py-3 hover:bg-yt-light/70 transition-colors flex flex-col lg:grid lg:items-center gap-3 ${
                isPublicBoard
                  ? 'lg:grid-cols-[minmax(0,1fr)_120px_96px_96px_110px_140px]'
                  : 'lg:grid-cols-[minmax(0,1fr)_110px_96px_110px_250px]'
              }`}
            >
              {/* Name + Compact Thumbnail */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => isPlayable && handlePlay(file)}
                  disabled={!isPlayable}
                  className={`relative w-20 h-11 sm:w-24 sm:h-14 rounded overflow-hidden flex items-center justify-center flex-shrink-0 group/thumb ${
                    isSubtitle
                      ? 'bg-gradient-to-br from-emerald-950/90 to-gray-900 border border-emerald-500/30 cursor-default'
                      : `bg-gray-900 ${isPlayable ? 'cursor-pointer' : 'cursor-default'}`
                  }`}
                  title={isPlayable ? t('file.play') : displayName}
                >
                  {isSubtitle ? (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Subtitles className="w-5 h-5 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-emerald-200">
                        {subtitleMeta?.format || 'SRT'}
                        {subtitleMeta?.lang ? `·${subtitleMeta.shortLabel}` : ''}
                      </span>
                    </div>
                  ) : thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={displayName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getSmallFileIcon(file.file_type)
                  )}
                  {isPlayable && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {!isSubtitle && file.duration ? (
                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 rounded">
                      {formatDuration(file.duration)}
                    </span>
                  ) : null}
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => isPlayable && handlePlay(file)}
                    className={`block w-full text-left font-medium text-sm text-white truncate ${
                      isPlayable ? 'hover:text-yt-red cursor-pointer' : 'cursor-default'
                    }`}
                    title={file.filename}
                  >
                    {displayName}
                  </button>

                  {isPublicBoard && file.public_description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5" title={file.public_description}>
                      {file.public_description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                    {folderPath && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 max-w-full truncate"
                        title={folderPath}
                      >
                        <Folder className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                        <span className="truncate">{folderPath}</span>
                      </span>
                    )}
                    {file.file_type === 'video' && file.resolution && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-medium">
                        {file.resolution}
                      </span>
                    )}
                    {subtitleBadge && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-medium"
                        title={t('subtitles.badgeTooltip', { langs: file.subtitles.map((s) => s.shortLabel).join(', ') })}
                      >
                        <Subtitles className="w-3 h-3" />
                        <span>{subtitleBadge}</span>
                      </span>
                    )}
                    {!isPublicBoard && Boolean(file.is_public) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-900/50 text-green-300">
                        <Globe className="w-3 h-3" />
                        <span>{t('list.publicBadge')}</span>
                      </span>
                    )}
                    {/* Mobile metadata inline */}
                    <span className="lg:hidden text-gray-500">
                      {t(`file.${file.file_type}`)} · {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Uploader (Public Board, Desktop) */}
              {isPublicBoard && (
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-300 truncate">
                  <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{file.uploader?.username}</span>
                </div>
              )}

              {/* Type (Desktop) */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-300">
                {getSmallFileIcon(file.file_type)}
                <span className="truncate">{t(`file.${file.file_type}`)}</span>
              </div>

              {/* Size (Desktop) */}
              <div className="hidden lg:block text-right text-xs text-gray-300 whitespace-nowrap">
                {formatFileSize(file.file_size)}
              </div>

              {/* Date (Desktop) */}
              <div className="hidden lg:block text-right text-xs text-gray-400 whitespace-nowrap">
                {new Date(file.created_at).toLocaleDateString()}
              </div>

              {/* Action Buttons (All Features Preserved) */}
              <div className="flex items-center justify-end flex-wrap gap-1 pt-1 lg:pt-0 border-t border-gray-800 lg:border-t-0">
                {isPlayable && (
                  <button
                    type="button"
                    onClick={() => handlePlay(file)}
                    className="p-1.5 text-white hover:bg-yt-red/80 bg-gray-800 rounded transition-colors"
                    title={t('file.play')}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}

                {isPublicBoard ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title={t('file.download')}
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
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
                    {canUnpublishPublic && (
                      <button
                        type="button"
                        onClick={() => handlePublishToggle(file)}
                        className="p-1.5 text-red-400 hover:bg-red-600/20 rounded transition-colors"
                        title={t('publicBoard.unpublish')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {currentUser?.permissions?.can_download_from_nas && (
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        title={t('file.download')}
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleShowInfo(file)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title={t('file.info')}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRename(file)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
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
                    <button
                      type="button"
                      onClick={() => handleDelete(file)}
                      className="p-1.5 text-red-400 hover:bg-red-600/20 rounded transition-colors"
                      title={t('file.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
