import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, TranslationDictionary, loadTranslations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'findmydonor_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'EN' || saved === 'HI') {
        return saved;
      }
    } catch (e) {
      // fallback
    }
    return 'EN';
  });

  // Lazy-loaded dictionary. Defaults to EN (bundled); HI (a separate chunk) is
  // fetched on demand via loadTranslations. Starts as null so we render a blank
  // tree until the initial dict is available (avoids EN-then-HI flash).
  const [t, setT] = useState<TranslationDictionary | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTranslations(language).then((dict) => {
      if (!cancelled) setT(dict);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-lang', language);
      document.documentElement.setAttribute('lang', language.toLowerCase());
    } catch (e) {
      // ignore
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
      // ignore storage errors
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'EN' ? 'HI' : 'EN');
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    toggleLanguage,
    t: t as TranslationDictionary,
  };

  return (
    <LanguageContext.Provider value={value}>
      {t ? children : null}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return fallback if hook is used outside provider
    return {
      language: 'EN',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: {} as TranslationDictionary,
    };
  }
  return context;
}
