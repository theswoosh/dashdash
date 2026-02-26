import { useState } from 'react';
import { LogOut, User, Shield, Image } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../hooks/use-auth.hook';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { THEMES } from '../themes/registry';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useBoard } from '../hooks/use-board.hook';
import { WallpaperPickerModal } from './wallpaper-picker.component';
import type { WidgetTemplate } from '../widgets/catalog';
import './ConfigPanel.css';

type Tab = 'widgets' | 'options' | 'themes';

// ── Add Widgets tab ──────────────────────────────────────────────────────────

function SidebarItem({ template }: { template: WidgetTemplate }) {
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const widgetTemplates = useWidgetTemplates();
  const Icon = template.icon;

  const prepareWidgetTemplateDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    // Use widgets.yml sizes if available, fall back to catalog defaults.
    const tmpl = widgetTemplates.find(t => t.type === template.type);
    const templateWidth = tmpl?.defaultSize.w ?? template.defaultSize.w;
    const templateHeight = tmpl?.defaultSize.h ?? template.defaultSize.h;
    // Must use '__dropping-elem__' — RGL's internal default ID for ghost placement.
    setDroppingItem({ i: '__dropping-elem__', w: templateWidth, h: templateHeight });
  };

  return (
    <div
      className="config-panel-item"
      draggable
      onDragStart={prepareWidgetTemplateDrag}
      title={template.description}
    >
      <span className="config-panel-item__icon">
        <Icon size={18} />
      </span>
      <div className="config-panel-item__info">
        <span className="config-panel-item__label">{template.label}</span>
        <span className="config-panel-item__desc">{template.description}</span>
      </div>
    </div>
  );
}

function WidgetsTab() {
  return (
    <>
      <div className="config-tab-hint">Drag onto grid</div>
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
  const { board, wallpapers, setActiveWallpaper, uploadWallpaper, deleteWallpaper } = useBoard();
  const [showPicker, setShowPicker] = useState(false);

  if (!board) return null;

  return (
    <>
      <div className="config-option-group">
        <label className="config-option-label">Wallpaper</label>
        <button className="wp-open-btn" onClick={() => setShowPicker(true)} aria-label="Open wallpaper library">
          {board.activeWallpaperId
            ? <img src={`/api/boards/${board.id}/background`} alt="" className="wp-open-thumb" />
            : <span className="wp-open-none"><Image size={16} /></span>
          }
          <span className="wp-open-label">
            {board.activeWallpaperId ? 'Change…' : 'None — click to set'}
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
  const boardName = useUIStore(s => s.boardName);
  const setBoardName = useUIStore(s => s.setBoardName);
  const { preferences, savePreferences } = usePreferences();

  const isBorderless = preferences?.borderless ?? false;

  const updateBoardName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBoardName(val);
    savePreferences({ boardName: val });
  };

  return (
    <div className="config-options">
      <div className="config-option-group">
        <label className="config-option-label" htmlFor="board-name">Board name</label>
        <input
          id="board-name"
          type="text"
          className="config-option-input"
          value={boardName}
          onChange={updateBoardName}
          placeholder="dashdash"
          maxLength={48}
        />
        <span className="config-option-hint">Shown in the top-left corner</span>
      </div>

      <WallpaperButton />

      <div className="config-option-group">
        <ToggleRow
          id="borderless-toggle"
          label="Borderless"
          checked={isBorderless}
          onChange={v => savePreferences({ borderless: v })}
        />
        <span className="config-option-hint">Removes all card borders and backgrounds</span>
      </div>

      <div className="config-option-group config-option-group--coming-soon">
        <span className="config-option-section-label">Coming soon</span>
        <ul className="config-coming-soon-list">
          <li>Grid columns &amp; row height</li>
        </ul>
      </div>
    </div>
  );
}

// ── Themes tab ───────────────────────────────────────────────────────────────

function ThemesTab() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const { savePreferences } = usePreferences();

  const applyTheme = (id: string) => {
    setTheme(id);
    savePreferences({ theme: id });
  };

  return (
    <div className="config-theme-list">
      {THEMES.map(t => (
        <button
          key={t.id}
          className={`config-theme-option${theme === t.id ? ' config-theme-option--active' : ''}`}
          onClick={() => applyTheme(t.id)}
          aria-pressed={theme === t.id}
        >
          <div className="config-theme-preview" data-theme-preview={t.id}>
            <div className="config-theme-preview-bar" />
            <div className="config-theme-preview-cards">
              <div className="config-theme-preview-card config-theme-preview-card--wide" />
              <div className="config-theme-preview-card config-theme-preview-card--tall" />
              <div className="config-theme-preview-card" />
            </div>
          </div>
          <div className="config-theme-meta">
            <t.Icon size={13} />
            <span className="config-theme-name">{t.name}</span>
          </div>
          <span className="config-theme-desc">{t.description}</span>
        </button>
      ))}
    </div>
  );
}

// ── User section ─────────────────────────────────────────────────────────────

function UserSection() {
  const { user, logout } = useAuth();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);

  if (!user) return null;

  return (
    <div className="cp-user-section">
      <span className="cp-user-name">{user.name}</span>
      <div className="cp-user-actions">
        <button className="cp-user-btn" onClick={() => setProfileOpen(true)}>
          <User size={12} /> Profile
        </button>
        {user.role === 'admin' && (
          <button className="cp-user-btn" onClick={() => setAdminPanelOpen(true)}>
            <Shield size={12} /> Admin
          </button>
        )}
        <button className="cp-user-btn cp-user-btn--danger" onClick={() => { void logout(); }}>
          <LogOut size={12} /> Logout
        </button>
      </div>
    </div>
  );
}

// ── ConfigPanel ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'widgets', label: 'Add Widgets' },
  { id: 'options', label: 'Options' },
  { id: 'themes', label: 'Themes' },
];

export function ConfigPanel() {
  const editMode = useUIStore(s => s.editMode);
  const [activeTab, setActiveTab] = useState<Tab>('widgets');

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
