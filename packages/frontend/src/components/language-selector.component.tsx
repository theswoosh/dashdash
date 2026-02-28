import { useAvailableLanguages, useLanguage, useT } from '../i18n';
import { usePreferences } from '../hooks/use-preferences.hook';
import './language-selector.css';

export function LanguageSelector() {
  const availableLanguages = useAvailableLanguages();
  const activeLanguage = useLanguage();
  const { savePreferences } = usePreferences();
  const t = useT();

  if (availableLanguages.length <= 1) return null;

  return (
    <select
      className="lang-select"
      value={activeLanguage}
      onChange={e => savePreferences({ language: e.target.value })}
      aria-label={t('userMenu.language')}
    >
      {availableLanguages.map(lang => (
        <option key={lang} value={lang}>
          {t(`languages.${lang}`) || lang}
        </option>
      ))}
    </select>
  );
}
