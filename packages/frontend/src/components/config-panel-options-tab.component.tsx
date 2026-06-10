import { useState } from 'react';
import { mutate } from 'swr';
import { Image } from 'lucide-react';
import { usePreferences } from '../hooks/use-preferences.hook';
import { useSettings } from '../hooks/use-settings.hook';
import { useBoard } from '../hooks/use-board.hook';
import { useAuth } from '../hooks/use-auth.hook';
import { useT } from '../i18n';
import { WallpaperPickerModal } from './wallpaper-picker.component';
import { BoardIconPicker } from './emoji-picker.component';

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

// ── Toggle row ────────────────────────────────────────────────────────────────

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

// ── Grid size (admin-only, global) ──────────────────────────────────────────────

interface GridSettings {
  sizes: number[];
  cellSize: number;
  gap: number;
}

const FALLBACK_GRID: GridSettings = { sizes: [10, 20, 40, 60, 80], cellSize: 40, gap: 4 };

function saveCellSize(cellSize: number) {
  void fetch('/api/settings/grid', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cellSize }),
  }).then(() => mutate('/api/settings'));
}

function nearestSizeIndex(sizes: number[], value: number): number {
  let best = 0;
  let bestDiff = Infinity;
  sizes.forEach((s, i) => {
    const diff = Math.abs(s - value);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

// Initial index derives from props; a changing `key` (in GridSection) re-seeds
// after each save, so no state-syncing effect is needed.
function GridSizeSlider({ grid }: { grid: GridSettings }) {
  const t = useT();
  const [index, setIndex] = useState(() => nearestSizeIndex(grid.sizes, grid.cellSize));
  const size = grid.sizes[index] ?? grid.cellSize;

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const i = Number(e.target.value);
    setIndex(i);
    const next = grid.sizes[i];
    if (next !== undefined) saveCellSize(next);
  };

  return (
    <div className="config-option-group">
      <label className="config-option-label" htmlFor="grid-size">
        {t('config.gridSize')}: {size} × {size}
      </label>
      <input
        id="grid-size"
        type="range"
        min={0}
        max={grid.sizes.length - 1}
        step={1}
        value={index}
        onChange={onSlide}
        className="grid-size-slider"
        list="grid-size-ticks"
      />
      <datalist id="grid-size-ticks">
        {grid.sizes.map((s, i) => <option key={s} value={i} />)}
      </datalist>
    </div>
  );
}

function GridSection() {
  const { user } = useAuth();
  const settings = useSettings();
  if (user?.role !== 'admin') return null;
  const stored = settings.grid ?? FALLBACK_GRID;
  const sizes = stored.sizes.length > 0 ? stored.sizes : FALLBACK_GRID.sizes;
  const grid: GridSettings = { sizes, cellSize: stored.cellSize, gap: stored.gap };
  // Remount (and re-seed) whenever the persisted grid changes.
  const seedKey = `${grid.cellSize}:${sizes.join(',')}`;
  return <GridSizeSlider key={seedKey} grid={grid} />;
}

// ── Options tab ───────────────────────────────────────────────────────────────

export function OptionsTab() {
  const t = useT();
  const { preferences, savePreferences } = usePreferences();
  const settings = useSettings();

  const isBorderless = preferences?.borderless ?? false;
  const headerIcon = preferences?.headerIcon ?? '';
  const isShowBoardName = preferences?.showBoardName !== false;
  const isHideTopbar = preferences?.hideTopbar ?? false;
  const isHeaderClock = preferences?.headerClock ?? false;
  const isHeaderSearch = preferences?.headerSearch ?? false;

  const allEngines = settings.searchEngines ?? [];
  const headerSearchEngine = preferences?.headerSearchEngine ?? allEngines[0]?.id ?? '';

  const updateBoardName = (e: React.ChangeEvent<HTMLInputElement>) => {
    savePreferences({ boardName: e.target.value });
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
            value={preferences?.boardName ?? ''}
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
          </div>
        )}
      </div>

      <GridSection />
    </div>
  );
}
