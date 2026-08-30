// Translations barrel — Phase 6 (6.3) lazy-load.
// EN is bundled statically; HI is fetched on demand via `loadTranslations`.
export type { Language, TranslationDictionary } from './types';
export { en } from './en';
// NOT exported statically: HI must be a separate lazy chunk.

/**
 * Load a translation dictionary. EN resolves synchronously from the bundled
 * module; HI is fetched via dynamic import (a separate chunk in the build).
 */
export async function loadTranslations(lang: 'EN' | 'HI') {
  if (lang === 'EN') {
    const { en } = await import('./en');
    return en;
  }
  const { hi } = await import('./hi');
  return hi;
}
