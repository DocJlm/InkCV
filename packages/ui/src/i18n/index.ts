import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh';
import en from './en';

export type Lang = 'zh' | 'en';

const LANG_KEY = 'inkcv.lang';

/** Resolve the initial UI language: stored choice, else browser preference. */
export function getInitialLang(): Lang {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

let started = false;

/** Idempotently initialise i18next with the InkCV resources. */
export function initI18n(): typeof i18n {
  if (started) return i18n;
  started = true;
  void i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: getInitialLang(),
    fallbackLng: 'en',
    // Keys contain literal dots (e.g. 'basics.name'); disable nesting separators
    // so the whole string is treated as one flat key.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

/** Switch UI language and persist the choice. */
export function setLang(lang: Lang): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, lang);
  void i18n.changeLanguage(lang);
}

export { i18n };
