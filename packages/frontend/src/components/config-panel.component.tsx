import { useState, useRef, useEffect } from 'react';
import { LogOut, User, Shield, Image } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../hooks/use-auth.hook';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { THEMES } from '../themes/registry';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useSettings } from '../hooks/use-settings.hook';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useBoard } from '../hooks/use-board.hook';
import { useT } from '../i18n';
import { WallpaperPickerModal } from './wallpaper-picker.component';
import type { WidgetTemplate } from '../widgets/catalog';
import './ConfigPanel.css';

type Tab = 'widgets' | 'options' | 'themes';

// ── Add Widgets tab ──────────────────────────────────────────────────────────

function SidebarItem({ template }: { template: WidgetTemplate }) {
  const t = useT();
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const widgetTemplates = useWidgetTemplates();
  const Icon = template.icon;

  const displayLabel = template.labelKey ? (t(template.labelKey) || template.label) : template.label;
  const displayDesc = template.descriptionKey ? (t(template.descriptionKey) || template.description) : template.description;

  const prepareWidgetTemplateDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    const tmpl = widgetTemplates.find(t => t.type === template.type);
    const templateWidth = tmpl?.defaultSize.w ?? template.defaultSize.w;
    const templateHeight = tmpl?.defaultSize.h ?? template.defaultSize.h;
    setDroppingItem({ i: '__dropping-elem__', w: templateWidth, h: templateHeight });
  };

  return (
    <div
      className="config-panel-item"
      draggable
      onDragStart={prepareWidgetTemplateDrag}
      title={displayDesc}
    >
      <span className="config-panel-item__icon">
        <Icon size={18} />
      </span>
      <div className="config-panel-item__info">
        <span className="config-panel-item__label">{displayLabel}</span>
        <span className="config-panel-item__desc">{displayDesc}</span>
      </div>
    </div>
  );
}

function WidgetsTab() {
  const t = useT();
  return (
    <>
      <div className="config-tab-hint">{t('config.dragOntoGrid')}</div>
      <div className="config-item-list">
        {WIDGET_CATALOG.map(template => (
          <SidebarItem key={template.type} template={template} />
        ))}
      </div>
    </>
  );
}

// ── Wallpaper button ──────────────────────────────────────────────────────────

function WallpaperButton() {
  const t = useT();
  const { board, wallpapers, setActiveWallpaper, uploadWallpaper, deleteWallpaper } = useBoard();
  const [showPicker, setShowPicker] = useState(false);

  if (!board) return null;

  return (
    <>
      <div className="config-option-group">
        <label className="config-option-label">{t('config.wallpaper')}</label>
        <button className="wp-open-btn" onClick={() => setShowPicker(true)} aria-label={t('wallpaper.library')}>
          {board.activeWallpaperId
            ? <img src={`/api/boards/${board.id}/background`} alt="" className="wp-open-thumb" />
            : <span className="wp-open-none"><Image size={16} /></span>
          }
          <span className="wp-open-label">
            {board.activeWallpaperId ? t('config.wallpaperChange') : t('config.wallpaperNone')}
          </span>
        </button>
      </div>

      {showPicker && (
        <WallpaperPickerModal
          boardId={board.id}
          wallpapers={wallpapers}
          activeWallpaperId={board.activeWallpaperId}
          onSetActive={id => void setActiveWallpaper(id)}
          onUpload={file => void uploadWallpaper(file)}
          onDelete={id => void deleteWallpaper(id)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ── Options tab ──────────────────────────────────────────────────────────────

const HEADER_ICON_PRESETS = [
  '🏠', '🖥️', '📊', '🌐', '⚡', '🎯', '🚀', '💻',
  '🔧', '📡', '⭐', '🎛️', '🌙', '☀️', '🔒', '📈',
  '🗂️', '📁', '🌊', '🔥', '🧭', '🕹️', '🏗️', '💫',
];

function BoardIconPicker({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (icon: string) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [isOpen]);

  const selectPreset = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  return (
    <div className="icon-picker" ref={pickerRef}>
      <div className="icon-picker__row">
        <button
          type="button"
          className="icon-picker__trigger"
          onClick={() => setIsOpen(o => !o)}
          aria-expanded={isOpen}
          title={t('config.boardIcon')}
        >
          {value
            ? <span className="icon-picker__preview" aria-hidden="true">{value}</span>
            : <span className="icon-picker__empty">＋</span>
          }
        </button>
        {value && (
          <button
            type="button"
            className="icon-picker__clear"
            onClick={() => { onChange(''); setIsOpen(false); }}
            aria-label={t('common.delete')}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div className="icon-picker__panel" role="dialog" aria-label={t('config.boardIcon')}>
          <div className="icon-picker__grid">
            {HEADER_ICON_PRESETS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className={`icon-picker__option${value === emoji ? ' icon-picker__option--active' : ''}`}
                onClick={() => selectPreset(emoji)}
                title={emoji}
                aria-pressed={value === emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="icon-picker__custom">
            <input
              className="config-option-input"
              type="text"
              placeholder="or type / paste any emoji…"
              maxLength={8}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                const customEmoji = (e.target as HTMLInputElement).value.trim();
                if (!customEmoji) return;
                onChange(customEmoji);
                setIsOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-toggle-row">
      <label className="config-option-label" htmlFor={id}>{label}</label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        className={`bg-toggle${checked ? ' bg-toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="bg-toggle__thumb" />
      </button>
    </div>
  );
}

function OptionsTab() {
  const t = useT();
  const boardName = useUIStore(s => s.boardName);
  const setBoardName = useUIStore(s => s.setBoardName);
  const { preferences, savePreferences } = usePreferences();
  const settings = useSettings();

  const isBorderless = preferences?.borderless ?? false;
  const headerIcon = preferences?.headerIcon ?? '';
  const isShowBoardName = preferences?.showBoardName !== false;
  const isHideTopbar = preferences?.hideTopbar ?? false;
  const isHeaderClock = preferences?.headerClock ?? false;
  const isHeaderSearch = preferences?.headerSearch ?? false;
  const headerSearchEngine = preferences?.headerSearchEngine ?? 'duckduckgo';

  const [localSearchPlaceholder, setLocalSearchPlaceholder] = useState('');
  const isPlaceholderInitialized = useRef(false);
  useEffect(() => {
    if (preferences !== undefined && !isPlaceholderInitialized.current) {
      setLocalSearchPlaceholder(preferences.headerSearchPlaceholder ?? '');
      isPlaceholderInitialized.current = true;
    }
  }, [preferences]);

  const builtInEngines = [
    { id: 'duckduckgo', label: 'DuckDuckGo' },
    { id: 'google',     label: 'Google' },
    { id: 'brave',      label: 'Brave' },
    { id: 'bing',       label: 'Bing' },
  ];
  const allEngines = [...builtInEngines, ...(settings.searchEngines ?? [])];

  const updateBoardName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nameValue = e.target.value;
    setBoardName(nameValue);
    savePreferences({ boardName: nameValue });
  };

  return (
    <div className="config-options">
      {/* ── Board ── */}
      <div className="config-option-group">
        <label className="config-option-label">{t('config.boardIcon')}</label>
        <BoardIconPicker
          value={headerIcon}
          onChange={icon => savePreferences({ headerIcon: icon })}
        />
        <span className="config-option-hint">{t('config.boardIconHint')}</span>
      </div>

      <div className="config-option-group">
        <ToggleRow
          id="show-board-name-toggle"
          label={t('config.showBoardName')}
          checked={isShowBoardName}
          onChange={v => savePreferences({ showBoardName: v })}
        />
        {isShowBoardName && (
          <input
            id="board-name"
            type="text"
            className="config-option-input"
            value={boardName}
            onChange={updateBoardName}
            placeholder="dashdash"
            maxLength={48}
          />
        )}
      </div>

      <WallpaperButton />

      <div className="config-option-group">
        <ToggleRow
          id="borderless-toggle"
          label={t('config.borderless')}
          checked={isBorderless}
          onChange={v => savePreferences({ borderless: v })}
        />
        <span className="config-option-hint">{t('config.borderlessHint')}</span>
      </div>

      {/* ── Header bar ── */}
      <div className="config-option-group">
        <span className="config-option-section-label">{t('config.headerBar')}</span>

        <ToggleRow
          id="hide-topbar-toggle"
          label={t('config.hideTopbar')}
          checked={isHideTopbar}
          onChange={v => savePreferences({ hideTopbar: v })}
        />
        {isHideTopbar && (
          <span className="config-option-hint">{t('config.hideTopbarHint')}</span>
        )}

        <ToggleRow
          id="header-clock-toggle"
          label={t('config.clock')}
          checked={isHeaderClock}
          onChange={v => savePreferences({ headerClock: v })}
        />
        {isHeaderClock && (
          <span className="config-option-hint">{t('config.clockHint')}</span>
        )}

        <ToggleRow
          id="header-search-toggle"
          label={t('config.searchBar')}
          checked={isHeaderSearch}
          onChange={v => savePreferences({ headerSearch: v })}
        />
        {isHeaderSearch && (
          <div className="config-option-indent">
            <div className="config-option-group">
              <label className="config-option-label" htmlFor="header-search-engine">{t('config.engine')}</label>
              <select
                id="header-search-engine"
                className="config-option-select"
                value={headerSearchEngine}
                onChange={e => savePreferences({ headerSearchEngine: e.target.value })}
              >
                {allEngines.map(e => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
            <div className="config-option-group">
              <label className="config-option-label" htmlFor="header-search-placeholder">{t('config.searchPlaceholder')}</label>
              <input
                id="header-search-placeholder"
                type="text"
                className="config-option-input"
                value={localSearchPlaceholder}
                onChange={e => setLocalSearchPlaceholder(e.target.value)}
                onBlur={e => savePreferences({ headerSearchPlaceholder: e.target.value })}
                placeholder="Search…"
                maxLength={48}
              />
            </div>
          </div>
        )}
      </div>

      <div className="config-option-group config-option-group--coming-soon">
        <span className="config-option-section-label">{t('config.comingSoon')}</span>
        <ul className="config-coming-soon-list">
          <li>Grid columns &amp; row height</li>
        </ul>
      </div>
    </div>
  );
}

// ── Themes tab ───────────────────────────────────────────────────────────────

function ThemesTab() {
  const t = useT();
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const { savePreferences } = usePreferences();

  const applyTheme = (id: string) => {
    setTheme(id);
    savePreferences({ theme: id });
  };

  return (
    <div className="config-theme-list">
      {THEMES.map(themeEntry => {
        const displayName = themeEntry.nameKey ? (t(themeEntry.nameKey) || themeEntry.name) : themeEntry.name;
        const displayDesc = themeEntry.descriptionKey ? (t(themeEntry.descriptionKey) || themeEntry.description) : themeEntry.description;
        return (
          <button
            key={themeEntry.id}
            className={`config-theme-option${theme === themeEntry.id ? ' config-theme-option--active' : ''}`}
            onClick={() => applyTheme(themeEntry.id)}
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

// ── User section ─────────────────────────────────────────────────────────────

function UserSection() {
  const t = useT();
  const { user, logout } = useAuth();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);

  if (!user) return null;

  return (
    <div className="cp-user-section">
      <span className="cp-user-name">{user.name}</span>
      <div className="cp-user-actions">
        <button className="cp-user-btn" onClick={() => setProfileOpen(true)}>
          <User size={12} /> {t('common.profile')}
        </button>
        {user.role === 'admin' && (
          <button className="cp-user-btn" onClick={() => setAdminPanelOpen(true)}>
            <Shield size={12} /> {t('common.admin')}
          </button>
        )}
        <button className="cp-user-btn cp-user-btn--danger" onClick={() => { void logout(); }}>
          <LogOut size={12} /> {t('common.logout')}
        </button>
      </div>
    </div>
  );
}

// ── ConfigPanel ──────────────────────────────────────────────────────────────

export function ConfigPanel() {
  const t = useT();
  const editMode = useUIStore(s => s.editMode);
  const [activeTab, setActiveTab] = useState<Tab>('widgets');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'widgets', label: t('config.tabs.addWidgets') },
    { id: 'options', label: t('config.tabs.options') },
    { id: 'themes', label: t('config.tabs.themes') },
  ];

  return (
    <aside className={`config-panel${editMode ? ' config-panel--open' : ''}`} aria-label="Configuration">
      <nav className="config-panel-tabs" aria-label="Config sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`config-tab-btn${activeTab === tab.id ? ' config-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="config-panel-body">
        {activeTab === 'widgets' && <WidgetsTab />}
        {activeTab === 'options' && <OptionsTab />}
        {activeTab === 'themes' && <ThemesTab />}
      </div>
      <UserSection />
    </aside>
  );
}
