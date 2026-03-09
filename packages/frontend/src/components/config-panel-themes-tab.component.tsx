import { THEMES } from '../themes/registry';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useT } from '../i18n';

export function ThemesTab() {
  const t = useT();
  const { preferences, savePreferences } = usePreferences();
  const theme = preferences?.theme ?? 'liquid-glass';

  return (
    <div className="config-theme-list">
      {THEMES.map(themeEntry => {
        const displayName = themeEntry.nameKey ? (t(themeEntry.nameKey) || themeEntry.name) : themeEntry.name;
        const displayDesc = themeEntry.descriptionKey ? (t(themeEntry.descriptionKey) || themeEntry.description) : themeEntry.description;
        return (
          <button
            key={themeEntry.id}
            className={`config-theme-option${theme === themeEntry.id ? ' config-theme-option--active' : ''}`}
            onClick={() => savePreferences({ theme: themeEntry.id })}
            aria-pressed={theme === themeEntry.id}
          >
            <div className="config-theme-preview" data-theme-preview={themeEntry.id}>
              <div className="config-theme-preview-bar" />
              <div className="config-theme-preview-cards">
                <div className="config-theme-preview-card config-theme-preview-card--wide" />
                <div className="config-theme-preview-card config-theme-preview-card--tall" />
                <div className="config-theme-preview-card" />
              </div>
            </div>
            <div className="config-theme-meta">
              <themeEntry.Icon size={13} />
              <span className="config-theme-name">{displayName}</span>
            </div>
            <span className="config-theme-desc">{displayDesc}</span>
          </button>
        );
      })}
    </div>
  );
}
