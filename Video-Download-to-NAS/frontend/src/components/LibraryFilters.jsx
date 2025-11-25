import React from 'react';
import { Search, SlidersHorizontal, Video, Music, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LibraryFilters({ 
  searchQuery, 
  onSearchChange, 
  fileTypeFilter, 
  onFileTypeChange,
  sortBy,
  onSortChange 
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

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3">
        {/* File Type Filter */}
        <div className="flex items-center gap-2 bg-yt-dark rounded-lg p-1">
          <button
            onClick={() => onFileTypeChange('all')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm ${
              fileTypeFilter === 'all' 
                ? 'bg-yt-red text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t('filter.allTypes')}</span>
          </button>
          <button
            onClick={() => onFileTypeChange('video')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm ${
              fileTypeFilter === 'video' 
                ? 'bg-yt-red text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>{t('filter.video')}</span>
          </button>
          <button
            onClick={() => onFileTypeChange('audio')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm ${
              fileTypeFilter === 'audio' 
                ? 'bg-yt-red text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>{t('filter.audio')}</span>
          </button>
          <button
            onClick={() => onFileTypeChange('subtitle')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-sm ${
              fileTypeFilter === 'subtitle' 
                ? 'bg-yt-red text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('filter.subtitle')}</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-4 py-2 bg-yt-dark border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yt-red focus:border-transparent cursor-pointer"
        >
          <option value="date-desc">{t('sort.dateDesc')}</option>
          <option value="date-asc">{t('sort.dateAsc')}</option>
          <option value="name-asc">{t('sort.nameAsc')}</option>
          <option value="name-desc">{t('sort.nameDesc')}</option>
          <option value="size-desc">{t('sort.sizeDesc')}</option>
          <option value="size-asc">{t('sort.sizeAsc')}</option>
        </select>
      </div>
    </div>
  );
}
