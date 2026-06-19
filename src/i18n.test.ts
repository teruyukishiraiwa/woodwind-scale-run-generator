import { describe, expect, it } from 'vitest';
import { resolveInitialLanguage, translations, type Language } from './i18n';

describe('i18n', () => {
  it('has the same translation keys for English and Japanese', () => {
    const languages: Language[] = ['en', 'ja'];
    const [first, ...rest] = languages.map((language) => Object.keys(translations[language]).sort());

    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });

  it('defaults to English regardless of browser language when no stored language exists', () => {
    expect(resolveInitialLanguage(null, 'ja-JP')).toBe('en');
    expect(resolveInitialLanguage(undefined, 'ja')).toBe('en');
  });

  it('resolves non-Japanese browser languages to English by default', () => {
    expect(resolveInitialLanguage(null, 'en-US')).toBe('en');
    expect(resolveInitialLanguage(undefined, 'fr-FR')).toBe('en');
  });

  it('prefers a valid stored language over the browser language', () => {
    expect(resolveInitialLanguage('en', 'ja-JP')).toBe('en');
    expect(resolveInitialLanguage('ja', 'en-US')).toBe('ja');
  });
});
