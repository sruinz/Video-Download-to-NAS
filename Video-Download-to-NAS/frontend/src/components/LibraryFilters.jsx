import React from 'react';
import {
  Search,
  SlidersHorizontal,
  Video,
  Music,
  FileText,
  LayoutGrid,
  List,
  FolderOpen,
  ScrollText,
  Layers
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

export default function LibraryFilters({
  searchQuery,
  onSearchChange,
  fileTypeFilter,
  onFileTypeChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  browseMode,
  onBrowseModeChange,
  pageSize,
  onPageSizeChange
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('filter.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-3 bg-yt-dark border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yt-red focus:border-transparent"
        />
      </div>

      {/* Filters & View Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        {/* Left: File Type Filter & Sort */}
        <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
          {/* File Type Filter */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 bg-yt-dark rounded-lg p-1 max-w-full">
            <button
              type="button"
              onClick={() => onFileTypeChange('all')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md transition-colors text-sm whitespace-nowrap ${
                fileTypeFilter === 'all'
                  ? 'bg-yt-red text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
              <span>{t('filter.allTypes')}</span>
            </button>
            <button
              type="button"
              onClick={() => onFileTypeChange('video')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md transition-colors text-sm whitespace-nowrap ${
                fileTypeFilter === 'video'
                  ? 'bg-yt-red text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Video className="w-4 h-4 flex-shrink-0" />
              <span>{t('filter.video')}</span>
            </button>
            <button
              type="button"
              onClick={() => onFileTypeChange('audio')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md transition-colors text-sm whitespace-nowrap ${
                fileTypeFilter === 'audio'
                  ? 'bg-yt-red text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Music className="w-4 h-4 flex-shrink-0" />
              <span>{t('filter.audio')}</span>
            </button>
            <button
              type="button"
              onClick={() => onFileTypeChange('subtitle')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md transition-colors text-sm whitespace-nowrap ${
                fileTypeFilter === 'subtitle'
                  ? 'bg-yt-red text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>{t('filter.subtitle')}</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label={t('sort.label')}
            className="px-3 py-2 bg-yt-dark border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yt-red focus:border-transparent cursor-pointer"
          >
            <option value="date-desc">{t('sort.dateDesc')}</option>
            <option value="date-asc">{t('sort.dateAsc')}</option>
            <option value="name-asc">{t('sort.nameAsc')}</option>
            <option value="name-desc">{t('sort.nameDesc')}</option>
            <option value="size-desc">{t('sort.sizeDesc')}</option>
            <option value="size-asc">{t('sort.sizeAsc')}</option>
            <option value="type-asc">{t('sort.typeAsc')}</option>
            <option value="type-desc">{t('sort.typeDesc')}</option>
          </select>
        </div>

        {/* Right: View Mode & Browse Mode Controls */}
        {(onViewModeChange || onBrowseModeChange) && (
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            {/* View Mode Switcher */}
            {onViewModeChange && (
              <div
                className="flex items-center gap-1 bg-yt-dark rounded-lg p-1 border border-gray-700"
                role="group"
                aria-label={t('view.modeLabel')}
              >
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-yt-red text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t('view.grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden md:inline">{t('view.grid')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === 'list'
                      ? 'bg-yt-red text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t('view.list')}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden md:inline">{t('view.list')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('folder')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === 'folder'
                      ? 'bg-yt-red text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t('view.folder')}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="hidden md:inline">{t('view.folder')}</span>
                </button>
              </div>
            )}

            {/* Browse Mode Switcher (Infinite Scroll vs Pagination) */}
            {onBrowseModeChange && (
              <div
                className="flex items-center gap-1 bg-yt-dark rounded-lg p-1 border border-gray-700"
                role="group"
                aria-label={t('browse.modeLabel')}
              >
                <button
                  type="button"
                  onClick={() => onBrowseModeChange('infinite')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    browseMode === 'infinite'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t('browse.infinite')}
                >
                  <ScrollText className="w-4 h-4" />
                  <span className="hidden lg:inline">{t('browse.infinite')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onBrowseModeChange('pagination')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    browseMode === 'pagination'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t('browse.pagination')}
                >
                  <Layers className="w-4 h-4" />
                  <span className="hidden lg:inline">{t('browse.pagination')}</span>
                </button>
              </div>
            )}

            {/* Page Size Selector */}
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label={t('browse.pageSizeLabel')}
                title={t('browse.pageSizeLabel')}
                className="px-2.5 py-2 bg-yt-dark border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yt-red focus:border-transparent cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {t('browse.perPage', { count: size })}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
