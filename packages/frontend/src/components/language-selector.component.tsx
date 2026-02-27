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
    <div className="lang-selector" aria-label={t('userMenu.language')}>
      {availableLanguages.map(lang => (
        <button
          key={lang}
          className={`lang-badge${lang === activeLanguage ? ' lang-badge--active' : ''}`}
          onClick={() => savePreferences({ language: lang })}
          aria-pressed={lang === activeLanguage}
          title={t(`languages.${lang}`) || lang}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
