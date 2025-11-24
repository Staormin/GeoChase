import { createI18n } from 'vue-i18n';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

// Get saved language from localStorage or default to null (will prompt user)
const savedLocale = localStorage.getItem('gpxCircle_language');

export const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: savedLocale || 'en', // Default to English if no saved language
  fallbackLocale: 'en',
  globalInjection: true, // Inject $t, $d, $n to all components
  messages: {
    en,
    fr,
  },
});

// Helper to check if language is set
export function isLanguageSet(): boolean {
  return localStorage.getItem('gpxCircle_language') !== null;
}

// Helper to set language
export function setLanguage(locale: string): void {
  localStorage.setItem('gpxCircle_language', locale);
  i18n.global.locale.value = locale as 'en' | 'fr';
}

// Helper to get available locales
export function getAvailableLocales(): string[] {
  return ['en', 'fr'];
}

export default i18n;
