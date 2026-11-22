import React, { useState, useEffect, useMemo } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPublicFiles } from '../api';
import showToast from '../utils/toast';
import UserProfileMenu from '../components/UserProfileMenu';
import LibraryFilters from '../components/LibraryFilters';
import VideoGrid from '../components/VideoGrid';
import VideoListView from '../components/VideoListView';
import VideoFolderView from '../components/VideoFolderView';
import FileBrowseContainer from '../components/FileBrowseContainer';
import { extractDisplayFilename } from '../utils/folderTree';
import { attachSubtitlesToFiles } from '../utils/subtitleUtils';

export default function PublicBoard({ onClose, currentUser, onLogout, onOpenShareLinks, onOpenSettings }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  // View & Browse states (persisted in localStorage)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('vdtn_publicBoard_viewMode');
    return ['grid', 'list', 'folder'].includes(saved) ? saved : 'grid';
  });
  const [browseMode, setBrowseMode] = useState(() => {
    const saved = localStorage.getItem('vdtn_publicBoard_browseMode');
    return ['infinite', 'pagination'].includes(saved) ? saved : 'pagination';
  });
  const [pageSize, setPageSize] = useState(() => {
    const saved = Number(localStorage.getItem('vdtn_publicBoard_pageSize'));
    return [12, 24, 48, 96].includes(saved) ? saved : 24;
  });

  useEffect(() => {
    localStorage.setItem('vdtn_publicBoard_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('vdtn_publicBoard_browseMode', browseMode);
  }, [browseMode]);

  useEffect(() => {
    localStorage.setItem('vdtn_publicBoard_pageSize', String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const firstPage = await getPublicFiles(1, 100, '');
      const collected = [...(firstPage.files || [])];
      const totalPages = firstPage.pagination?.pages || 1;

      for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
        const pageData = await getPublicFiles(nextPage, 100, '');
        if (pageData?.files?.length) {
          collected.push(...pageData.files);
        }
      }

      setFiles(collected);
    } catch (error) {
      console.error('Failed to load public files:', error);
      showToast.error(t('publicBoard.loadFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const enrichedFiles = useMemo(() => attachSubtitlesToFiles(files), [files]);

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...enrichedFiles];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((file) => {
        const title = (file.public_title || '').toLowerCase();
        const filename = (file.filename || '').toLowerCase();
        const description = (file.public_description || '').toLowerCase();
        const uploader = (file.uploader?.username || '').toLowerCase();
        return (
          title.includes(query) ||
          filename.includes(query) ||
          description.includes(query) ||
          uploader.includes(query)
        );
      });
    }

    if (fileTypeFilter === 'all') {
      result = result.filter((file) => file.file_type !== 'subtitle');
    } else {
      result = result.filter((file) => file.file_type === fileTypeFilter);
    }

    result.sort((a, b) => {
      const nameA = a.public_title || extractDisplayFilename(a.filename);
      const nameB = b.public_title || extractDisplayFilename(b.filename);
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'size-desc':
          return (b.file_size || 0) - (a.file_size || 0);
        case 'size-asc':
          return (a.file_size || 0) - (b.file_size || 0);
        case 'type-asc':
          return (a.file_type || '').localeCompare(b.file_type || '') || nameA.localeCompare(nameB);
        case 'type-desc':
          return (b.file_type || '').localeCompare(a.file_type || '') || nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    return result;
  }, [enrichedFiles, searchQuery, fileTypeFilter, sortBy]);

  return (
    <div className="min-h-screen bg-yt-dark text-white p-4 overflow-x-clip">
      <div className="w-full min-w-0 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold whitespace-nowrap">{t('publicBoard.title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-gray-400">
                {filteredAndSortedFiles.length === files.length
                  ? t('library.files', { count: files.length })
                  : `${filteredAndSortedFiles.length} / ${files.length}`}
              </span>
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
          onSearchChange={setSearchQuery}
          fileTypeFilter={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          browseMode={browseMode}
          onBrowseModeChange={setBrowseMode}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        {/* Files Area */}
        {loading && files.length === 0 ? (
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
                : t('publicBoard.noResultsDescription')}
            </p>
          </div>
        ) : viewMode === 'folder' ? (
          <VideoFolderView
            files={filteredAndSortedFiles}
            onFileUpdated={loadFiles}
            currentUser={currentUser}
            sortBy={sortBy}
            onSortChange={setSortBy}
            browseMode={browseMode}
            pageSize={pageSize}
            isPublicBoard
            storagePrefix="publicBoard"
          />
        ) : (
          <FileBrowseContainer
            items={filteredAndSortedFiles}
            browseMode={browseMode}
            pageSize={pageSize}
            resetKey={`${searchQuery}|${fileTypeFilter}|${sortBy}|${viewMode}`}
          >
            {(visibleFiles) => (
              viewMode === 'list' ? (
                <VideoListView
                  files={visibleFiles}
                  playlistFiles={filteredAndSortedFiles}
                  onFileUpdated={loadFiles}
                  currentUser={currentUser}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  isPublicBoard
                />
              ) : (
                <VideoGrid
                  files={visibleFiles}
                  playlistFiles={filteredAndSortedFiles}
                  onFileUpdated={loadFiles}
                  currentUser={currentUser}
                  isPublicBoard
                />
              )
            )}
          </FileBrowseContainer>
        )}
      </div>
    </div>
  );
}
