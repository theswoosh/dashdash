import { useState, useRef } from 'react';
import { useUIStore } from '../store/uiStore';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { THEMES } from '../themes/registry';
import { usePreferences } from '../hooks/usePreferences';
import { useWidgetTemplates } from '../hooks/useWidgetTemplates';
import { useBoard } from '../hooks/useBoard';
import type { WidgetTemplate } from '../widgets/catalog';
import './ConfigPanel.css';

type Tab = 'widgets' | 'options' | 'themes';

// ── Add Widgets tab ──────────────────────────────────────────────────────────

function SidebarItem({ template }: { template: WidgetTemplate }) {
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const widgetTemplates = useWidgetTemplates();
  const Icon = template.icon;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    // Use widgets.yml sizes if available, fall back to catalog defaults.
    const tmpl = widgetTemplates.find(t => t.type === template.type);
    const w = tmpl?.defaultSize.w ?? template.defaultSize.w;
    const h = tmpl?.defaultSize.h ?? template.defaultSize.h;
    // Must use '__dropping-elem__' — RGL's internal default ID for ghost placement.
    setDroppingItem({ i: '__dropping-elem__', w, h });
  };

  return (
    <div
      className="config-panel-item"
      draggable
      onDragStart={handleDragStart}
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

// ── Background toggle ─────────────────────────────────────────────────────────

function BackgroundToggle() {
  const { board, setWallpaperEnabled, upload } = useBoard();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = board?.wallpaperEnabled ?? false;
  const busy = uploading || !board;

  const handleToggle = () => {
    if (busy) return;
    if (!enabled) {
      if (board!.hasBackground) {
        // Image already stored — just enable it.
        void setWallpaperEnabled(true);
      } else {
        // No image yet — open file picker.
        inputRef.current?.click();
      }
    } else {
      void setWallpaperEnabled(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await upload(file);
      await setWallpaperEnabled(true);
    } catch {
      // upload or enable failed — toggle stays off, user sees no change
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="config-option-group">
      <div className="bg-toggle-row">
        <label className="config-option-label" htmlFor="bg-toggle-btn">Custom wallpaper</label>
        <button
          id="bg-toggle-btn"
          role="switch"
          aria-checked={enabled}
          className={`bg-toggle${enabled ? ' bg-toggle--on' : ''}${uploading ? ' bg-toggle--busy' : ''}`}
          onClick={handleToggle}
          disabled={busy}
          aria-label={uploading ? 'Uploading…' : 'Toggle custom wallpaper'}
        >
          <span className="bg-toggle__thumb" />
        </button>
      </div>
      {uploading && <span className="config-option-hint">Uploading…</span>}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
        style={{ display: 'none' }}
        onChange={e => void handleFile(e)}
      />
    </div>
  );
}

// ── Options tab ──────────────────────────────────────────────────────────────

function OptionsTab() {
  const boardName = useUIStore(s => s.boardName);
  const setBoardName = useUIStore(s => s.setBoardName);
  const { savePreferences } = usePreferences();

  const handleBoardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          onChange={handleBoardNameChange}
          placeholder="dashdash"
          maxLength={48}
        />
        <span className="config-option-hint">Shown in the top-left corner</span>
      </div>

      <BackgroundToggle />

      <div className="config-option-group config-option-group--coming-soon">
        <span className="config-option-section-label">Coming soon</span>
        <ul className="config-coming-soon-list">
          <li>Grid columns &amp; row height</li>
          <li>Widget border style</li>
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

  const handleThemeChange = (id: string) => {
    setTheme(id);
    savePreferences({ theme: id });
  };

  return (
    <div className="config-theme-list">
      {THEMES.map(t => (
        <button
          key={t.id}
          className={`config-theme-option${theme === t.id ? ' config-theme-option--active' : ''}`}
          onClick={() => handleThemeChange(t.id)}
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
    </aside>
  );
}
