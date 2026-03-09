import { useState } from 'react';
import { Settings2, Save } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useSettings } from '../hooks/use-settings.hook';
import { useT } from '../i18n';
import { TopbarClock } from './topbar-clock.component';
import { TopbarSearch } from './topbar-search.component';
import { ClockConfigModal } from './clock-config-modal.component';
import './Topbar.css';
import './WidgetConfigModal.css';

export function Topbar() {
  const t = useT();
  const editMode = useUIStore(s => s.editMode);
  const toggleEditMode = useUIStore(s => s.toggleEditMode);
  const { preferences, savePreferences } = usePreferences();
  const settings = useSettings();
  const [isClockConfigOpen, setIsClockConfigOpen] = useState(false);

  const headerIcon = preferences?.headerIcon ?? '';
  const isShowBoardName = preferences?.showBoardName !== false;
  const isHeaderClock = preferences?.headerClock ?? false;
  const isHeaderSearch = preferences?.headerSearch ?? false;
  const isHideTopbar = preferences?.hideTopbar ?? false;

  const allEngines = settings.searchEngines ?? [];
  const effectiveTimezone = preferences?.headerClockTimezone || settings.timezone || undefined;

  if (isHideTopbar && !editMode) {
    return (
      <header className="topbar topbar--hidden">
        <button
          className="topbar-btn"
          onClick={toggleEditMode}
          title={t('topbar.openConfig')}
          aria-label={t('topbar.openConfigAria')}
        >
          <Settings2 size={16} />
        </button>
      </header>
    );
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">
        {headerIcon && <span className="topbar-icon" aria-hidden="true">{headerIcon}</span>}
        {isShowBoardName && (
          <span className="topbar-title">{preferences?.boardName || 'dashdash'}</span>
        )}
      </div>

      <div className="topbar-center">
        {isHeaderSearch && (
          <TopbarSearch engine={preferences?.headerSearchEngine} engines={allEngines} />
        )}
      </div>

      <div className="topbar-actions">
        {isHeaderClock && (
          <div
            className={`topbar-clock-wrapper${editMode ? ' topbar-clock-wrapper--editable' : ''}`}
            onClick={editMode ? () => setIsClockConfigOpen(true) : undefined}
            role={editMode ? 'button' : undefined}
            tabIndex={editMode ? 0 : undefined}
            onKeyDown={editMode ? (e => { if (e.key === 'Enter' || e.key === ' ') setIsClockConfigOpen(true); }) : undefined}
            title={editMode ? t('topbar.configureClock') : undefined}
          >
            <TopbarClock
              format={preferences?.headerClockFormat}
              timezone={effectiveTimezone}
              showSeconds={preferences?.headerClockShowSeconds}
            />
            {editMode && <Settings2 size={10} className="topbar-clock-edit-icon" aria-hidden="true" />}
          </div>
        )}
        <button
          className={`topbar-btn${editMode ? ' topbar-btn--active' : ''}`}
          onClick={toggleEditMode}
          title={editMode ? t('topbar.saveExit') : t('topbar.openConfig')}
          aria-label={editMode ? t('topbar.saveExitAria') : t('topbar.openConfigAria')}
        >
          {editMode ? <Save size={16} /> : <Settings2 size={16} />}
        </button>
      </div>

      {isClockConfigOpen && (
        <ClockConfigModal
          format={preferences?.headerClockFormat ?? '24h'}
          showSeconds={preferences?.headerClockShowSeconds !== false}
          timezone={preferences?.headerClockTimezone ?? ''}
          settingsTimezone={settings.timezone}
          onSave={patch => savePreferences(patch)}
          onClose={() => setIsClockConfigOpen(false)}
        />
      )}
    </header>
  );
}
