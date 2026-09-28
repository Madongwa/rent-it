// The languages the navbar language button offers - English plus 12 Indian
// languages, each shown in its own script (`short` is the button's own
// label). Keep in sync with backend/src/lib/languages.js and the
// profiles.preferred_language check constraint in backend/schema.sql.
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', short: 'EN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', short: 'हि' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', short: 'বা' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', short: 'తె' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', short: 'म' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', short: 'த' },
  { code: 'ur', name: 'Urdu', native: 'اردو', short: 'ار' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', short: 'ગુ' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', short: 'ಕ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', short: 'മ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', short: 'ଓ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', short: 'ਪੰ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', short: 'অ' },
];

export const DEFAULT_LANGUAGE = 'en';

export function isSupportedLanguage(code) {
  return LANGUAGES.some((l) => l.code === code);
}

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}
