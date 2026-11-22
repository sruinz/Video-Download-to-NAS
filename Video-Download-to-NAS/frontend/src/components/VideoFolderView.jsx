import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  ArrowLeft,
  Calendar,
  Globe,
  User,
  HardDrive,
  LayoutGrid,
  List,
  Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildFolderViewData } from '../utils/folderTree';
import FileBrowseContainer from './FileBrowseContainer';
import VideoGrid from './VideoGrid';
import VideoListView from './VideoListView';

function formatFolderSize(bytes) {
  if (!bytes) return '0 MB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  const gb = mb / 1024;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export default function VideoFolderView({
  files,
  onFileDeleted,
  onFileUpdated,
  currentUser,
  sortBy,
  onSortChange,
  browseMode = 'infinite',
  pageSize = 24,
  isPublicBoard = false,
  storagePrefix = 'library'
}) {
  const { t } = useTranslation();

  const availableModes = useMemo(() => (
    isPublicBoard
      ? [
          { id: 'date', label: t('folder.groupDate'), icon: Calendar },
          { id: 'site', label: t('folder.groupSite'), icon: Globe },
          { id: 'uploader', label: t('folder.groupUploader'), icon: User }
        ]
      : [
          { id: 'actual', label: t('folder.groupActual'), icon: HardDrive },
          { id: 'date', label: t('folder.groupDate'), icon: Calendar },
          { id: 'site', label: t('folder.groupSite'), icon: Globe }
        ]
  ), [isPublicBoard, t]);

  const defaultGroupMode = isPublicBoard ? 'date' : 'actual';
  const groupStorageKey = `vdtn_${storagePrefix}_folderGroupMode`;
  const innerViewStorageKey = `vdtn_${storagePrefix}_folderInnerView`;

  const [groupMode, setGroupMode] = useState(() => {
    const saved = localStorage.getItem(groupStorageKey);
    const validIds = isPublicBoard ? ['date', 'site', 'uploader'] : ['actual', 'date', 'site'];
    return validIds.includes(saved) ? saved : defaultGroupMode;
  });

  const [innerViewMode, setInnerViewMode] = useState(() => {
    const saved = localStorage.getItem(innerViewStorageKey);
    return saved === 'list' ? 'list' : 'grid';
  });

  const [currentPath, setCurrentPath] = useState([]);

  useEffect(() => {
    localStorage.setItem(groupStorageKey, groupMode);
  }, [groupStorageKey, groupMode]);

  useEffect(() => {
    localStorage.setItem(innerViewStorageKey, innerViewMode);
  }, [innerViewStorageKey, innerViewMode]);

  const handleGroupModeChange = (nextMode) => {
    setGroupMode(nextMode);
    setCurrentPath([]);
  };

  const folderData = useMemo(() => (
    buildFolderViewData(files, {
      mode: groupMode,
      currentPath,
      username: currentUser?.username || '',
      uncategorizedLabel: t('folder.uncategorized')
    })
  ), [files, groupMode, currentPath, currentUser?.username, t]);

  // 필터 변경 등으로 현재 경로에 폴더와 파일이 모두 사라졌으면 루트로 안전 복귀
  useEffect(() => {
    if (currentPath.length > 0 && folderData.folders.length === 0 && folderData.files.length === 0) {
      setCurrentPath([]);
    }
  }, [currentPath.length, folderData.folders.length, folderData.files.length]);

  const getPreviewThumbUrl = (file) => {
    if (!file || !file.thumbnail) return null;
    if (file.thumbnail.startsWith('http')) return file.thumbnail;
    return `/api/thumbnail/${file.id}?token=${localStorage.getItem('token')}`;
  };

  const handleGoUp = () => {
    setCurrentPath((prev) => prev.slice(0, -1));
  };

  const pathResetKey = `${groupMode}:${currentPath.join('/')}:${sortBy}:${files.length}`;

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Folder Toolbar: Group Mode + Inner View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-yt-dark rounded-lg p-3 border border-gray-700/80">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {currentPath.length > 0 && (
            <button
              type="button"
              onClick={handleGoUp}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 mr-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md text-xs font-medium transition-colors"
              title={t('folder.goUp')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('folder.goUp')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentPath([])}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
              currentPath.length === 0
                ? 'text-white font-semibold bg-gray-800'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Home className="w-4 h-4 text-yt-red" />
            <span>{t('folder.root')}</span>
          </button>

          {currentPath.map((segment, index) => {
            const isLast = index === currentPath.length - 1;
            return (
              <React.Fragment key={`${segment}-${index}`}>
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  className={`px-2 py-1 rounded text-sm truncate max-w-[180px] transition-colors ${
                    isLast
                      ? 'text-white font-semibold bg-gray-800'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title={segment}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Folder Grouping Mode + Inner View Mode */}
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="flex flex-wrap items-center gap-1 bg-gray-900/70 rounded-lg p-1 border border-gray-700 max-w-full">
            {availableModes.map((modeItem) => {
              const IconComp = modeItem.icon;
              return (
                <button
                  key={modeItem.id}
                  type="button"
                  onClick={() => handleGroupModeChange(modeItem.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    groupMode === modeItem.id
                      ? 'bg-yt-red text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{modeItem.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 bg-gray-900/70 rounded-lg p-1 border border-gray-700">
            <button
              type="button"
              onClick={() => setInnerViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                innerViewMode === 'grid'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={t('view.grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setInnerViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                innerViewMode === 'list'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={t('view.list')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hint when actual mode has no subfolders (root-only files) */}
      {!isPublicBoard && groupMode === 'actual' && currentPath.length === 0 && folderData.totalSubfoldersAtRoot === 0 && files.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-lg bg-blue-900/20 border border-blue-700/40 text-xs sm:text-sm text-blue-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>{t('folder.noSubfoldersHint')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGroupModeChange('date')}
              className="px-2.5 py-1 rounded bg-blue-600/40 hover:bg-blue-600/60 text-white text-xs transition-colors"
            >
              {t('folder.groupDate')}
            </button>
            <button
              type="button"
              onClick={() => handleGroupModeChange('site')}
              className="px-2.5 py-1 rounded bg-blue-600/40 hover:bg-blue-600/60 text-white text-xs transition-colors"
            >
              {t('folder.groupSite')}
            </button>
          </div>
        </div>
      )}

      {/* Subfolders Grid */}
      {folderData.folders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            {t('folder.foldersHeading', { count: folderData.folders.length })}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {folderData.folders.map((folder) => {
              const previewUrl = getPreviewThumbUrl(folder.previewFile);
              return (
                <button
                  key={folder.path.join('/')}
                  type="button"
                  onClick={() => setCurrentPath(folder.path)}
                  className="group text-left bg-yt-dark hover:bg-gray-800 border border-gray-700/80 hover:border-yt-red/60 rounded-lg overflow-hidden transition-all flex items-center gap-3 p-3"
                >
                  <div className="relative w-14 h-12 rounded-md overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                    {previewUrl ? (
                      <>
                        <img
                          src={previewUrl}
                          alt={folder.name}
                          loading="lazy"
                          className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity"
                        />
                        <FolderOpen className="w-6 h-6 text-yellow-400 absolute drop-shadow" />
                      </>
                    ) : (
                      <Folder className="w-7 h-7 text-yellow-400 group-hover:scale-105 transition-transform" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-white truncate group-hover:text-yt-red transition-colors" title={folder.name}>
                      {folder.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span>{t('folder.itemCount', { count: folder.fileCount })}</span>
                      <span>·</span>
                      <span>{formatFolderSize(folder.totalSize)}</span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Files inside current folder */}
      {folderData.files.length > 0 && (
        <div>
          {folderData.folders.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 mt-2">
              {t('folder.filesHeading', { count: folderData.files.length })}
            </h3>
          )}
          <FileBrowseContainer
            items={folderData.files}
            browseMode={browseMode}
            pageSize={pageSize}
            resetKey={pathResetKey}
          >
            {(visibleFiles) => (
              innerViewMode === 'list' ? (
                <VideoListView
                  files={visibleFiles}
                  playlistFiles={folderData.files}
                  onFileDeleted={onFileDeleted}
                  onFileUpdated={onFileUpdated}
                  currentUser={currentUser}
                  sortBy={sortBy}
                  onSortChange={onSortChange}
                  isPublicBoard={isPublicBoard}
                />
              ) : (
                <VideoGrid
                  files={visibleFiles}
                  playlistFiles={folderData.files}
                  onFileDeleted={onFileDeleted}
                  onFileUpdated={onFileUpdated}
                  currentUser={currentUser}
                  isPublicBoard={isPublicBoard}
                />
              )
            )}
          </FileBrowseContainer>
        </div>
      )}
    </div>
  );
}
