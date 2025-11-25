/**
 * Footer Component
 * 버전 정보 및 가이드 링크 표시
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = ({ currentVersion, updateAvailable }) => {
  const { t } = useTranslation();

  return (
    <footer className="bg-yt-darker border-t border-yt-light py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-400 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span>VDTN</span>
          <span>•</span>
          <span className="flex items-center gap-2">
            {t('update.version')}: {currentVersion || 'unknown'}
            {updateAvailable && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-600/30">
                {t('update.updateAvailable')}
              </span>
            )}
          </span>
        </div>
        
        <div>
          <a
            href="https://svrforum.com/article_series/dispArticle_seriesView?series_id=8"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            {t('update.guide')}
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
