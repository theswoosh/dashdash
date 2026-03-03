import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, Save, Search, X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useSettings, type SearchEngine } from '../hooks/use-settings.hook';
import { useT } from '../i18n';
import './Topbar.css';
import './WidgetConfigModal.css';

const BUILT_IN_ENGINES: SearchEngine[] = [
  { id: 'duckduckgo', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' },
  { id: 'google',     label: 'Google',     url: 'https://www.google.com/search?q={query}' },
  { id: 'brave',      label: 'Brave',      url: 'https://search.brave.com/search?q={query}' },
  { id: 'bing',       label: 'Bing',       url: 'https://www.bing.com/search?q={query}' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TopbarClock({
  format,
  timezone,
  showSeconds,
}: {
  readonly format?: string | undefined;
  readonly timezone?: string | undefined;
  readonly showSeconds?: boolean | undefined;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const resolvedFormat = format ?? '24h';
  const isShowSeconds = showSeconds !== false;

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: isShowSeconds ? '2-digit' : undefined,
    hour12: resolvedFormat === '12h',
    timeZone: timezone || undefined,
  }).format(now);

  return <span className="topbar-clock">{timeStr}</span>;
}

function TopbarSearch({
  engine,
  placeholder,
  engines,
}: {
  readonly engine?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly engines: readonly SearchEngine[];
}) {
  const [query, setQuery] = useState('');

  const resolvedEngine = engine ?? 'duckduckgo';
  const selectedEngine = engines.find(e => e.id === resolvedEngine) ?? engines[0];
  const urlTemplate = selectedEngine?.url ?? BUILT_IN_ENGINES[0]!.url;
  const resolvedPlaceholder = placeholder || 'Search…';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const url = urlTemplate.replace('{query}', encodeURIComponent(query.trim()));
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  return (
    <form className="topbar-search" onSubmit={submitSearch}>
      <Search size={13} className="topbar-search__icon" />
      <input
        className="topbar-search__input"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
      />
    </form>
  );
}

// ── Clock config modal ────────────────────────────────────────────────────────

interface ClockConfigPatch {
  headerClockFormat?: string;
  headerClockShowSeconds?: boolean;
  headerClockTimezone?: string;
}

function ClockConfigModal({
  format,
  showSeconds,
  timezone,
  settingsTimezone,
  onSave,
  onClose,
}: {
  readonly format: string;
  readonly showSeconds: boolean;
  readonly timezone: string;
  readonly settingsTimezone: string | undefined;
  readonly onSave: (patch: ClockConfigPatch) => void;
  readonly onClose: () => void;
}) {
  const t = useT();
  const [localTimezone, setLocalTimezone] = useState(timezone);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('topbar.clockSettings')}
      >
        <div className="modal-header">
          <span className="modal-title">{t('topbar.clockSettings')}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="config-field">
            <label className="config-label">{t('topbar.format')}</label>
            <select
              className="config-input config-select"
              value={format}
              onChange={e => onSave({ headerClockFormat: e.target.value })}
            >
              <option value="24h">{t('topbar.clockFormat24h')}</option>
              <option value="12h">{t('topbar.clockFormat12h')}</option>
            </select>
          </div>

          <label className="config-field config-field--checkbox">
            <input
              type="checkbox"
              checked={showSeconds}
              onChange={e => onSave({ headerClockShowSeconds: e.target.checked })}
            />
            <span>{t('topbar.showSeconds')}</span>
          </label>

          <div className="config-field">
            <label className="config-label">
              {t('topbar.timezone')}
              {settingsTimezone && !localTimezone && (
                <span className="config-label__counter">default: {settingsTimezone}</span>
              )}
            </label>
            <input
              className="config-input"
              type="text"
              value={localTimezone}
              onChange={e => setLocalTimezone(e.target.value)}
              onBlur={e => onSave({ headerClockTimezone: e.target.value })}
              placeholder={settingsTimezone ? `From settings.yaml: ${settingsTimezone}` : 'e.g. America/New_York'}
            />
          </div>
        </div>
        <div className="modal-footer">
          <div />
          <div className="modal-footer-actions">
            <button className="modal-btn modal-btn--primary" onClick={onClose}>{t('common.done')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export function Topbar() {
  const t = useT();
  const editMode = useUIStore(s => s.editMode);
  const toggleEditMode = useUIStore(s => s.toggleEditMode);
  const boardName = useUIStore(s => s.boardName);
  const { preferences, savePreferences } = usePreferences();
  const settings = useSettings();
  const [isClockConfigOpen, setIsClockConfigOpen] = useState(false);

  const headerIcon = preferences?.headerIcon ?? '';
  const isShowBoardName = preferences?.showBoardName !== false;
  const isHeaderClock = preferences?.headerClock ?? false;
  const isHeaderSearch = preferences?.headerSearch ?? false;
  const isHideTopbar = preferences?.hideTopbar ?? false;

  const allEngines: SearchEngine[] = [
    ...BUILT_IN_ENGINES,
    ...(settings.searchEngines ?? []),
  ];

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
          <span className="topbar-title">{boardName || 'dashdash'}</span>
        )}
      </div>

      <div className="topbar-center">
        {isHeaderSearch && (
          <TopbarSearch
            engine={preferences?.headerSearchEngine}
            placeholder={preferences?.headerSearchPlaceholder}
            engines={allEngines}
          />
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
