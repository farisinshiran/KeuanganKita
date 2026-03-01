import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations } from './translations';

const I18nContext = createContext({
  lang: 'id',
  setLang: () => {},
  t: (key, fallback) => fallback || key,
});

const STORAGE_KEY = 'app_lang';

const getNestedValue = (obj, path) => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (!result || typeof result !== 'object' || !(key in result)) return undefined;
    result = result[key];
  }
  return result;
};

export const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'id' ? saved : 'id';
  });

  const setLang = useCallback((nextLang) => {
    const safeLang = nextLang === 'en' ? 'en' : 'id';
    setLangState(safeLang);
    localStorage.setItem(STORAGE_KEY, safeLang);
  }, []);

  const t = useCallback((key, fallback = '') => {
    const currentPack = translations[lang] || translations.id;
    const idPack = translations.id;
    const translated = getNestedValue(currentPack, key) ?? getNestedValue(idPack, key);
    if (translated === undefined || translated === null) return fallback || key;
    return translated;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
