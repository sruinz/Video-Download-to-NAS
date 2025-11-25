import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Play, Download as DownloadIcon, ExternalLink, User, Calendar, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPublicFiles, getFileUrl, unpublishFileFromBoard } from '../api';
import { useModal } from '../contexts/ModalContext';
import showToast from '../utils/toast';
import UserProfileMenu from '../components/UserProfileMenu';
import LibraryFilters from '../components/LibraryFilters';

export default function PublicBoard({ onClose, currentUser, onLogout, onOpenShareLinks, onOpenSettings }) {
  const { t } = useTranslation();
  const { showVideoPlayer, showConfirmModal } = useModal();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [page]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await getPublicFiles(page, 20, searchQuery);
      setFiles(data.files);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load public files:', error);
      showToast.error(`공개 파일을 불러오는데 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Apply file type filter
    if (fileTypeFilter !== 'all') {
      result = result.filter(file => file.file_type === fileTypeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return (a.public_title || a.filename).localeCompare(b.public_title || b.filename);
        case 'name-desc':
          return (b.public_title || b.filename).localeCompare(a.public_title || a.filename);
        case 'size-desc':
          return (b.file_size || 0) - (a.file_size || 0);
        case 'size-asc':
          return (a.file_size || 0) - (b.file_size || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [files, fileTypeFilter, sortBy]);

  const handlePlay = (file) => {
    if (file.file_type === 'video' || file.file_type === 'audio') {
      // Mark file as from public board for proper API endpoint usage
      showVideoPlayer({ ...file, fromPublicBoard: true });
    }
  };

  const handleUnpublish = async (fileId) => {
    try {
      const confirmed = await showConfirmModal({
        title: t('publicBoard.unpublish'),
        message: t('publicBoard.unpublishConfirm'),
        confirmText: t('modal.delete'),
        cancelText: t('modal.cancel'),
        danger: true
      });

      if (!confirmed) return;
      
      await unpublishFileFromBoard(fileId);
      showToast.success(t('publicBoard.unpublishSuccess'));
      loadFiles(); // Reload the list
    } catch (error) {
      if (error.message !== 'User cancelled') {
        console.error('Failed to unpublish file:', error);
        showToast.error(t('publicBoard.unpublishFailed'));
      }
    }
  };

  const handleDownload = async (file) => {
    try {
      const url = getFileUrl(file.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast.error('다운로드에 실패했습니다');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-yt-dark text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">{t('publicBoard.title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {t('publicBoard.backButton')}
              </button>
              <UserProfileMenu 
                currentUser={currentUser} 
                onLogout={onLogout}
                onOpenShareLinks={onOpenShareLinks}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </div>
          <p className="text-gray-400">{t('publicBoard.description')}</p>
        </div>

        {/* Filters */}
        <LibraryFilters
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          fileTypeFilter={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Files Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">{t('publicBoard.loading')}</p>
          </div>
        ) : filteredAndSortedFiles.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400">
              {files.length === 0 ? t('publicBoard.empty') : t('publicBoard.noResults')}
            </p>
            <p className="text-gray-500 mt-2">
              {files.length === 0 
                ? t('publicBoard.emptyDescription')
                : t('publicBoard.noResultsDescription')
              }
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedFiles.map(file => (
                <div key={file.id} className="bg-yt-light rounded-lg overflow-hidden hover:bg-gray-700 transition-colors group">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-800 flex items-center justify-center">
                    {file.thumbnail ? (
                      <img
                        src={
                          file.thumbnail.startsWith('http') 
                            ? file.thumbnail 
                            : `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`
                        }
                        alt={file.public_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-500">
                        {file.file_type === 'video' ? (
                          <Play className="w-12 h-12" />
                        ) : (
                          <DownloadIcon className="w-12 h-12" />
                        )}
                      </div>
                    )}
                    
                    {/* Unpublish button for own files or super_admin - shown on hover */}
                    {currentUser && (file.uploader.id === currentUser.id || currentUser.role === 'super_admin') && (
                      <button
                        onClick={() => handleUnpublish(file.id)}
                        className="absolute top-2 right-2 p-2 bg-red-600/80 hover:bg-red-600 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                        title={t('publicBoard.unpublish')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Duration */}
                    {file.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(file.duration)}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {(file.file_type === 'video' || file.file_type === 'audio') && (
                        <button
                          onClick={() => handlePlay(file)}
                          className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                          title="재생"
                        >
                          <Play className="w-5 h-5" />
                        </button>
                      )}
                      {file.original_url && (
                        <a
                          href={file.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-blue-600/60 hover:bg-blue-600/80 rounded-full transition-colors"
                          title="원본 영상 보기"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        title="다운로드"
                      >
                        <DownloadIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-2 line-clamp-2">
                      {file.public_title}
                    </h3>
                    
                    {file.public_description && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {file.public_description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{file.uploader.username}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      {formatFileSize(file.file_size)} • {file.file_type}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-8 flex justify-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 bg-yt-light hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    이전
                  </button>
                  
                  <span className="px-4 py-2 bg-yt-light rounded-lg">
                    {page} / {pagination.pages}
                  </span>
                  
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === pagination.pages}
                    className="px-4 py-2 bg-yt-light hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
