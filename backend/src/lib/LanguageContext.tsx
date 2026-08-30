import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationDictionary } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Kept as 'raktdaan_language' (old brand) for backward-compat with existing
// users' saved language preference in localStorage. Renaming would reset it.
const LANGUAGE_STORAGE_KEY = 'raktdaan_language';

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
    t: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
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
      t: translations.EN,
    };
  }
  return context;
}
