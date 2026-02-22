import { useEffect } from 'react';
import { X } from 'lucide-react';
import { THEMES } from '../themes/registry';
import { useUIStore } from '../store/uiStore';
import './SettingsPanel.css';

export function SettingsPanel() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const toggleSettingsPanel = useUIStore(s => s.toggleSettingsPanel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettingsPanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSettingsPanel]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) toggleSettingsPanel();
  };

  return (
    <div
      className="settings-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Appearance settings"
    >
      <div className="settings-panel">
        <div className="settings-header">
          <h2 className="settings-title">Appearance</h2>
          <button
            className="settings-close"
            onClick={toggleSettingsPanel}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <p className="settings-section-label">Theme</p>
        <div className="settings-theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-option${theme === t.id ? ' theme-option--active' : ''}`}
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
            >
              {/* Mini preview — vars are scoped via data-theme-preview */}
              <div className="theme-preview" data-theme-preview={t.id}>
                <div className="theme-preview-bar" />
                <div className="theme-preview-cards">
                  <div className="theme-preview-card theme-preview-card--wide" />
                  <div className="theme-preview-card theme-preview-card--tall" />
                  <div className="theme-preview-card" />
                </div>
              </div>

              <div className="theme-option-meta">
                <t.Icon size={13} />
                <span className="theme-option-name">{t.name}</span>
              </div>
              <span className="theme-option-desc">{t.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
