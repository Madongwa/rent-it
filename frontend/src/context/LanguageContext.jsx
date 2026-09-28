import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '../lib/languages';
import { createPageTranslator } from '../lib/pageTranslator';

const STORAGE_KEY = 'rentit.language';

// Defaults to English outside the provider (e.g. a component test).
const LanguageContext = createContext({ lang: DEFAULT_LANGUAGE, setLang: () => {} });

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeLanguage(code) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode / blocked storage - the choice lasts for this visit only.
  }
}

// The language picked with the navbar language button. Remembered in this
// browser, and on the profile for logged-in users so it follows them to
// other devices. While it isn't English, the whole page is translated in
// place (see lib/pageTranslator.js).
export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => readStoredLanguage() || DEFAULT_LANGUAGE);
  const translatorRef = useRef(null);

  useEffect(() => {
    translatorRef.current = createPageTranslator({
      root: document.body,
      fetchTranslations: (code, texts) => api.translateUi(code, texts).then((r) => r.translations),
    });
    return () => translatorRef.current.stop();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    translatorRef.current?.start(lang);
  }, [lang]);

  // On log in: a language already picked in this browser wins and is saved
  // to the profile; otherwise the profile's saved language is used.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .getMyProfile()
      .then((profile) => {
        if (cancelled) return;
        const local = readStoredLanguage();
        if (local && local !== profile.preferred_language) {
          api.updateMyProfile({ preferred_language: local }).catch(() => {});
        } else if (!local && isSupportedLanguage(profile.preferred_language)) {
          storeLanguage(profile.preferred_language);
          setLangState(profile.preferred_language);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setLang = useCallback(
    (code) => {
      if (!isSupportedLanguage(code)) return;
      storeLanguage(code);
      setLangState(code);
      if (user) api.updateMyProfile({ preferred_language: code }).catch(() => {});
    },
    [user]
  );

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
