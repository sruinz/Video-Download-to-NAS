import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ko from './locales/ko.json';

// Get saved language or detect browser language
const savedLanguage = localStorage.getItem('language');
const browserLanguage = navigator.language.split('-')[0];
const defaultLanguage = savedLanguage || (browserLanguage === 'ko' ? 'ko' : 'en');

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko }
    },
    lng: defaultLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
