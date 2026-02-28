import { createContext, useContext, useMemo, type ReactNode } from 'react';

type NestedRecord = Record<string, unknown>;

interface I18nContextValue {
  language: string;
  availableLanguages: string[];
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  availableLanguages: ['en'],
  t: key => key,
});

/** Resolves a dot-separated key from a nested translations object. */
function resolveKey(obj: NestedRecord, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as NestedRecord)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Replaces {{varName}} placeholders with values from vars. */
function interpolate(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? `{{${name}}}`);
}

interface I18nProviderProps {
  language: string;
  translations: Record<string, NestedRecord>;
  availableLanguages: string[];
  children: ReactNode;
}

export function I18nProvider({ language, translations, availableLanguages, children }: I18nProviderProps) {
  const t = useMemo(() => {
    const active = translations[language] ?? {};
    const fallback = translations['en'] ?? {};

    return (key: string, vars?: Record<string, string>): string => {
      const str = resolveKey(active, key) ?? resolveKey(fallback, key) ?? key;
      return vars ? interpolate(str, vars) : str;
    };
  }, [language, translations]);

  const value = useMemo(
    () => ({ language, availableLanguages, t }),
    [language, availableLanguages, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns the translation function for the active language. */
export function useT(): (key: string, vars?: Record<string, string>) => string {
  return useContext(I18nContext).t;
}

/** Returns the active language code. */
export function useLanguage(): string {
  return useContext(I18nContext).language;
}

/** Returns all available language codes. */
export function useAvailableLanguages(): string[] {
  return useContext(I18nContext).availableLanguages;
}
