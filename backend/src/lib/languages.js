// The languages the site can be switched to (the navbar language button) -
// English plus 12 Indian languages. Keep in sync with
// frontend/src/lib/languages.js and the profiles.preferred_language check
// constraint in schema.sql.
export const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  mr: 'Marathi',
  ta: 'Tamil',
  ur: 'Urdu',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  or: 'Odia',
  pa: 'Punjabi',
  as: 'Assamese',
};

export function isSupportedLanguage(code) {
  return typeof code === 'string' && Object.hasOwn(LANGUAGE_NAMES, code);
}
