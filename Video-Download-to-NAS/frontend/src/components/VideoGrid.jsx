import React from 'react';
import { Play, Download as DownloadIcon, Trash2, FileVideo, FileAudio, FileText, ExternalLink, Globe, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { deleteFile, getFileUrl, publishFileToBoard, unpublishFileFromBoard } from '../api';
import showToast from '../utils/toast';
import { useModal } from '../contexts/ModalContext';

export default function VideoGrid({ files, onFileDeleted, onFileUpdated, currentUser }) {
  const { t } = useTranslation();
  const { showConfirmModal, showVideoPlayer, openModal } = useModal();
  
  // Filter only video and audio files for playlist
  const playableFiles = files.filter(file => 
    file.file_type === 'video' || file.file_type === 'audio'
  );

  const handleDelete = async (file) => {
    try {
      const confirmed = await showConfirmModal({
        title: t('file.delete'),
        message: `${t('library.deleteConfirm')}\n\n"${file.filename}"`,
        confirmText: t('modal.delete'),
        cancelText: t('modal.cancel'),
        danger: true
      });

      if (!confirmed) return;

      const toastId = showToast.loading('Deleting file...');
      try {
        await deleteFile(file.id);
        onFileDeleted(file.id);
        showToast.dismiss(toastId);
        showToast.success(t('library.deleteSuccess'));
      } catch (error) {
        showToast.dismiss(toastId);
        showToast.error(t('library.deleteFailed', { error: error.response?.data?.detail || error.message }));
      }
    } catch (error) {
      // User cancelled
    }
  };

  const handlePlay = (file) => {
    const currentIndex = playableFiles.findIndex(f => f.id === file.id);
    showVideoPlayer(file, playableFiles, currentIndex);
  };

  const handleDownload = async (file) => {
    const toastId = showToast.loading('Downloading...');
    try {
      const response = await fetch(getFileUrl(file.id), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract just the filename without path
      const filename = file.filename.split('/').pop();
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      showToast.dismiss(toastId);
      showToast.success('Download completed!');
    } catch (error) {
      showToast.dismiss(toastId);
      showToast.error('Download failed: ' + error.message);
    }
  };

  const handlePublishToggle = async (file) => {
    if (file.is_public) {
      // Unpublish
      try {
        const confirmed = await showConfirmModal({
          title: t('publicBoard.unpublish'),
          message: t('publicBoard.unpublishConfirm'),
          confirmText: t('modal.delete'),
          cancelText: t('modal.cancel'),
          danger: true
        });

        if (!confirmed) return;

        await unpublishFileFromBoard(file.id);
        showToast.success(t('publicBoard.unpublishSuccess'));
        // Refresh the file list
        if (onFileUpdated) onFileUpdated();
      } catch (error) {
        if (error.message !== 'User cancelled') {
          showToast.error(t('publicBoard.unpublishFailed'));
        }
      }
    } else {
      // Publish - show modal for title and description
      openModal('publishFile', { file, onPublished: onFileUpdated || onFileDeleted });
    }
  };

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

  const formatFileSize = (bytes) => {
    if (!bytes) return t('file.unknown');
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
      {files.map((file) => (
        <div
          key={file.id}
          className="bg-yt-light rounded-lg overflow-hidden hover:bg-yt-dark transition-colors group"
        >
          {/* Thumbnail / Icon */}
          <div className="aspect-video bg-yt-dark flex items-center justify-center relative">
            {file.thumbnail ? (
              <img
                src={
                  file.thumbnail.startsWith('http') 
                    ? file.thumbnail 
                    : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`
                }
                alt={file.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              getFileIcon(file.file_type)
            )}

            {file.duration && (
              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold">
                {formatDuration(file.duration)}
              </div>
            )}

            {/* Hover overlay - Main actions only */}
            <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              {(file.file_type === 'video' || file.file_type === 'audio') && (
                <button
                  onClick={() => handlePlay(file)}
                  className="p-3 sm:p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  title={t('file.play')}
                >
                  <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
              {currentUser?.permissions?.can_download_from_nas && (
                <button
                  onClick={() => handleDownload(file)}
                  className="p-3 sm:p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  title={t('file.download')}
                >
                  <DownloadIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
              <button
                onClick={() => handleDelete(file)}
                className="p-3 sm:p-4 bg-red-600/60 hover:bg-red-600/80 rounded-full transition-colors"
                title={t('file.delete')}
              >
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 sm:p-4">
            <h3 className="font-semibold text-sm line-clamp-2 mb-2 break-words" title={file.filename}>
              {file.filename.split('/').pop()}
            </h3>
            <div className="flex items-center justify-between text-xs text-gray-400 gap-2 mb-2">
              <span className="truncate">{t(`file.${file.file_type}`)}</span>
              <span className="whitespace-nowrap">{formatFileSize(file.file_size)}</span>
            </div>
            
            {/* Action buttons row */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1">
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
                    onClick={() => handlePublishToggle(file)}
                    className={`p-1.5 rounded transition-colors ${
                      file.is_public 
                        ? 'text-green-400 hover:bg-green-600/20' 
                        : 'text-purple-400 hover:bg-purple-600/20'
                    }`}
                    title={file.is_public ? '공개 게시판에서 제거' : '공개 게시판에 게시'}
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                )}
                {currentUser?.permissions?.can_create_share_links && (
                  <button
                    onClick={() => openModal('createShareLink', { file, currentUser })}
                    className="p-1.5 text-yellow-400 hover:bg-yellow-600/20 rounded transition-colors"
                    title="공유 링크 생성"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(file.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
