import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n';
import { WallpaperPickerModal } from '../components/wallpaper-picker.component';
import type { WallpaperEntry, BuiltinWallpaperEntry } from '../hooks/use-board.hook';

const EN_TRANSLATIONS = {
  en: {
    common: { close: 'Close' },
    widgetCard: { holdToDelete: 'Hold to delete' },
    wallpaper: {
      library: 'Wallpaper Library',
      noBackground: 'No background',
      none: 'None',
      upload: 'Upload new wallpaper',
      deleteWallpaper: 'Delete wallpaper',
      setAsWallpaper: 'Set as wallpaper',
      builtin: 'Built-in',
      themeDefault: 'Theme default',
    },
  },
};

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider language="en" translations={EN_TRANSLATIONS} availableLanguages={['en']}>
      {ui}
    </I18nProvider>
  );
}

const UPLOADS: WallpaperEntry[] = [{ id: 'upload-abc', url: '/api/boards/b1/wallpapers/upload-abc', uploadedAt: '2026-01-01' }];
const BUILTINS: BuiltinWallpaperEntry[] = [
  { name: 'ascii', file: 'ascii_bg.png', url: '/api/wallpapers/builtin/ascii_bg.png' },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ holdToDeleteMs: 1000 }) }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function baseProps(overrides: Partial<Parameters<typeof WallpaperPickerModal>[0]> = {}) {
  return {
    boardId: 'b1',
    wallpapers: UPLOADS,
    builtinWallpapers: BUILTINS,
    activeWallpaperId: null,
    onSetActive: vi.fn(),
    onUpload: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('WallpaperPickerModal', () => {
  it('renders built-in tiles from the manifest without a delete button', () => {
    wrap(<WallpaperPickerModal {...baseProps()} />);
    const builtinTiles = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('/wallpapers/builtin/'));
    expect(builtinTiles.length).toBe(1);
    // No delete affordance rendered for the built-in section (aria-label 'Delete wallpaper' only applies to uploads).
    expect(screen.getAllByLabelText('Delete wallpaper')).toHaveLength(1); // only the upload's delete button
  });

  it('does not render a "Built-in" section header when the manifest is empty', () => {
    wrap(<WallpaperPickerModal {...baseProps({ builtinWallpapers: [] })} />);
    expect(screen.queryByText('Built-in')).not.toBeInTheDocument();
  });

  it('clicking "Theme default" calls onSetActive(null)', () => {
    const onSetActive = vi.fn();
    wrap(<WallpaperPickerModal {...baseProps({ onSetActive })} />);
    fireEvent.click(screen.getByTitle('Theme default'));
    expect(onSetActive).toHaveBeenCalledWith(null);
  });

  it('clicking "None" calls onSetActive(\'none\')', () => {
    const onSetActive = vi.fn();
    wrap(<WallpaperPickerModal {...baseProps({ onSetActive })} />);
    fireEvent.click(screen.getByTitle('No background'));
    expect(onSetActive).toHaveBeenCalledWith('none');
  });

  it('clicking a built-in tile calls onSetActive with the builtin: id', () => {
    const onSetActive = vi.fn();
    wrap(<WallpaperPickerModal {...baseProps({ onSetActive })} />);
    const builtinButtons = screen.getAllByTitle('Set as wallpaper');
    fireEvent.click(builtinButtons[builtinButtons.length - 1]!);
    expect(onSetActive).toHaveBeenCalledWith('builtin:ascii_bg.png');
  });

  it('marks "Theme default" as pressed when activeWallpaperId is null', () => {
    wrap(<WallpaperPickerModal {...baseProps({ activeWallpaperId: null })} />);
    expect(screen.getByTitle('Theme default')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('No background')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks "None" as pressed when activeWallpaperId is \'none\'', () => {
    wrap(<WallpaperPickerModal {...baseProps({ activeWallpaperId: 'none' })} />);
    expect(screen.getByTitle('No background')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Theme default')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the matching built-in tile as pressed when activeWallpaperId is builtin:<file>', () => {
    wrap(<WallpaperPickerModal {...baseProps({ activeWallpaperId: 'builtin:ascii_bg.png' })} />);
    const builtinButtons = screen.getAllByTitle('Set as wallpaper');
    expect(builtinButtons[builtinButtons.length - 1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle('Theme default')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTitle('No background')).toHaveAttribute('aria-pressed', 'false');
  });
});
