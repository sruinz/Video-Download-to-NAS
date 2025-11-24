import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ko' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-4 py-2 bg-yt-light hover:bg-gray-700 rounded-lg transition-colors"
      title={t('language.title')}
    >
      <Languages className="w-5 h-5" />
      <span className="font-medium">
        {i18n.language === 'ko' ? 'EN' : '한국어'}
      </span>
    </button>
  );
}
