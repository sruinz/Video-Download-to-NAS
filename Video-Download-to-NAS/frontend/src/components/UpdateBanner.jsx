/**
 * UpdateBanner Component
 * 새 버전 알림 배너
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink } from 'lucide-react';

const UpdateBanner = ({ currentVersion, onDismiss }) => {
  const { t } = useTranslation();

  const handleUpdateGuideClick = () => {
    window.open(
      'https://svrforum.com/article_series/dispArticle_seriesView?series_id=8',
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 border-b border-blue-500/30 px-4 py-3 animate-slideDown">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🆕</span>
          <div>
            <p className="text-blue-200 font-medium">
              {t('update.newVersionAvailable')}
            </p>
            <p className="text-blue-300 text-sm">
              {t('update.currentVersion')}: {currentVersion}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdateGuideClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            {t('update.viewGuide')}
            <ExternalLink className="w-4 h-4" />
          </button>
          
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
            aria-label={t('update.dismiss')}
          >
            <X className="w-4 h-4 text-blue-200" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
