import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteFile, getFileUrl, unpublishFileFromBoard, renameFile } from '../api';
import showToast from '../utils/toast';
import { useModal } from '../contexts/ModalContext';
import { extractDisplayFilename } from '../utils/folderTree';

/**
 * 그리드뷰, 리스트뷰, 폴더뷰 및 공개 게시판에서 공통으로 사용하는 파일 액션과 포맷터 훅
 */
export function useFileActions({
  files = [],
  playlistFiles = null,
  onFileDeleted,
  onFileUpdated,
  currentUser,
  isPublicBoard = false
}) {
  const { t } = useTranslation();
  const { showConfirmModal, showVideoPlayer, openModal, showInputModal } = useModal();

  // 연속 재생에 사용할 재생 가능 파일 목록 (페이지네이션/스크롤 슬라이스가 아닌 전체 컨텍스트 목록 우선)
  const playableFiles = useMemo(() => {
    const source = Array.isArray(playlistFiles) ? playlistFiles : files;
    return source
      .filter((file) => file.file_type === 'video' || file.file_type === 'audio')
      .map((file) => (isPublicBoard ? { ...file, fromPublicBoard: true } : file));
  }, [playlistFiles, files, isPublicBoard]);

  const handlePlay = (file) => {
    if (file.file_type !== 'video' && file.file_type !== 'audio') return;
    const targetFile = isPublicBoard ? { ...file, fromPublicBoard: true } : file;
    const currentIndex = playableFiles.findIndex((f) => f.id === file.id);
    showVideoPlayer(targetFile, playableFiles, currentIndex >= 0 ? currentIndex : 0);
  };

  const handleDownload = async (file) => {
    const toastId = showToast.loading(t('file.downloading'));
    try {
      const downloadEndpoint = isPublicBoard
        ? `/api/public-board/files/${file.id}/stream`
        : getFileUrl(file.id);

      const response = await fetch(downloadEndpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = extractDisplayFilename(file.filename);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      showToast.dismiss(toastId);
      showToast.success(t('file.downloadCompleted'));
    } catch (error) {
      showToast.dismiss(toastId);
      showToast.error(t('file.downloadFailed', { error: error.message }));
    }
  };

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

      const toastId = showToast.loading(t('file.deleting'));
      try {
        await deleteFile(file.id);
        if (onFileDeleted) onFileDeleted(file.id);
        showToast.dismiss(toastId);
        showToast.success(t('library.deleteSuccess'));
      } catch (error) {
        showToast.dismiss(toastId);
        showToast.error(t('library.deleteFailed', { error: error.response?.data?.detail || error.message }));
      }
    } catch (_error) {
      // 사용자 취소
    }
  };

  const handleRename = async (file) => {
    const currentFilename = extractDisplayFilename(file.filename);
    const lastDotIndex = currentFilename.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? currentFilename.substring(0, lastDotIndex) : currentFilename;
    const extension = lastDotIndex > 0 ? currentFilename.substring(lastDotIndex) : '';

    try {
      const newFilename = await showInputModal({
        title: t('file.renameTitle'),
        label: t('file.renamePrompt'),
        defaultValue: nameWithoutExt,
        placeholder: t('file.newFilename'),
        validation: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return t('file.filenameEmpty');
          if (trimmed.length > 200) return t('file.filenameTooLong');
          if (/[<>:"|?*\x00-\x1f/\\]/.test(trimmed)) return t('file.invalidFilename');
          return null;
        }
      });

      if (!newFilename) return;

      const toastId = showToast.loading(`${t('file.rename')}...`);
      try {
        const finalFilename = newFilename.trim() + extension;
        await renameFile(file.id, finalFilename);
        showToast.dismiss(toastId);
        showToast.success(t('file.renameSuccess'));
        if (onFileUpdated) onFileUpdated();
      } catch (error) {
        showToast.dismiss(toastId);
        showToast.error(error.message || t('file.renameFailed'));
      }
    } catch (_error) {
      // 사용자 취소
    }
  };

  const handlePublishToggle = async (file) => {
    if (file.is_public || isPublicBoard) {
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
        if (onFileUpdated) onFileUpdated();
      } catch (error) {
        if (error && error.message !== 'User cancelled') {
          showToast.error(t('publicBoard.unpublishFailed'));
        }
      }
    } else {
      openModal('publishFile', { file, onPublished: onFileUpdated || onFileDeleted });
    }
  };

  const handleShowInfo = (file) => {
    openModal('videoInfo', { file });
  };

  const handleCreateShareLink = (file) => {
    openModal('createShareLink', { file, currentUser });
  };

  const getThumbnailUrl = (file) => {
    if (!file || !file.thumbnail) return null;
    if (file.thumbnail.startsWith('http')) {
      return file.thumbnail;
    }
    return `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return t('file.unknown');
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    const gb = mb / 1024;
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    playableFiles,
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
  };
}
