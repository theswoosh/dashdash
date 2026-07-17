import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ServiceConfig } from '@dashdash/types';
import { ThemeProvider } from '../themes/registry';
import { I18nProvider } from '../i18n';
import { WidgetCard } from '../components/widget-card.component';

const EN_TRANSLATIONS = {
  en: {
    widgetCard: {
      dragToMove: 'Drag to move',
      holdToDelete: 'Hold to delete',
      holdToDeleteAria: 'Hold to delete widget',
      configureWidget: 'Configure widget',
      refreshNotepad: 'Refresh notepad',
      up: 'Up', down: 'Down', unknown: 'Unknown',
      noHostConfigured: 'No host configured', checking: 'Checking…',
    },
  },
};

function wrap(ui: ReactNode, themeId = 'classic') {
  // Use 'classic' by default — ClassicCard has no canvas/ResizeObserver complexity
  return render(
    <I18nProvider language="en" translations={EN_TRANSLATIONS} availableLanguages={['en']}>
      <ThemeProvider themeId={themeId}>{ui}</ThemeProvider>
    </I18nProvider>
  );
}

const clockService: ServiceConfig = {
  id: 'clock-main',
  title: 'Clock',
  widget: 'clock',
  layout: { w: 2, h: 2, x: 0, y: 0 },
  options: { format: '24h' },
};

const unknownService: ServiceConfig = {
  id: 'w1',
  title: 'My Widget',
  widget: 'unknown-widget-type',
  layout: { w: 2, h: 2, x: 0, y: 0 },
};

describe('WidgetCard — view mode', () => {
  it('renders the widget title', () => {
    wrap(<WidgetCard service={clockService} editMode={false} />);
    expect(screen.getByText('Clock')).toBeInTheDocument();
  });

  it('does not show drag handle when not in edit mode', () => {
    wrap(<WidgetCard service={clockService} editMode={false} />);
    expect(screen.queryByTitle('Drag to move')).not.toBeInTheDocument();
  });

  it('falls back to FallbackWidget for unknown widget types', () => {
    wrap(<WidgetCard service={unknownService} editMode={false} />);
    expect(screen.getByText('My Widget')).toBeInTheDocument();
    expect(screen.getByText('unknown-widget-type')).toBeInTheDocument();
  });
});

describe('WidgetCard — edit mode', () => {
  it('shows the drag handle', () => {
    wrap(<WidgetCard service={clockService} editMode={true} />);
    expect(screen.getByTitle('Drag to move')).toBeInTheDocument();
  });
});

describe('WidgetCard — theme switching', () => {
  it('renders with atom theme', () => {
    wrap(<WidgetCard service={{ ...clockService, title: 'ATOM Widget' }} editMode={false} />, 'atom');
    expect(screen.getByText('ATOM Widget')).toBeInTheDocument();
  });

  it('renders with liquid-glass theme (with canvas mock)', () => {
    wrap(<WidgetCard service={{ ...clockService, title: 'Glass Widget' }} editMode={false} />, 'liquid-glass');
    expect(screen.getByText('Glass Widget')).toBeInTheDocument();
  });
});

const hcService: ServiceConfig = {
  id: 'hc-1',
  title: 'Jellyfin',
  widget: 'healthcheck',
  layout: { w: 2, h: 2, x: 0, y: 0 },
  options: { ping: false, description: 'Media server', showName: 'below' },
};

describe('Healthcheck — description tooltip', () => {
  it('exposes the description as a title tooltip on the widget body', async () => {
    const { container } = wrap(<WidgetCard service={hcService} editMode={false} />);
    await waitFor(() => expect(container.querySelector('.healthcheck-widget')).not.toBeNull());
    expect(container.querySelector('.healthcheck-widget')).toHaveAttribute('title', 'Media server');
  });

  it('exposes the description on the tiny-layout title', async () => {
    const tiny: ServiceConfig = {
      ...hcService,
      options: { ...hcService.options, layoutSize: 'tiny', internalUrl: 'https://jf.local' },
    };
    wrap(<WidgetCard service={tiny} editMode={false} />);
    await waitFor(() => expect(screen.getByText('Jellyfin')).toHaveAttribute('title', 'Media server'));
  });
});

describe('WidgetCard — theme-safe custom colors (M1 guard)', () => {
  // The active theme's surfaces are cached (module-level, keyed by theme id)
  // the first time WidgetCard reads them for a given id — so each case below
  // uses a DIFFERENT real theme id (the only ones the registry resolves to)
  // to get a fresh getComputedStyle read instead of a stale cached one.
  const varsSet: string[] = [];
  function setThemeVar(name: string, value: string) {
    document.documentElement.style.setProperty(name, value);
    varsSet.push(name);
  }

  afterEach(() => {
    for (const name of varsSet.splice(0)) document.documentElement.style.removeProperty(name);
  });

  it('applies custom colors unchanged on a legacy board (no color_theme)', () => {
    const service: ServiceConfig = {
      ...clockService,
      id: 'legacy-colors',
      options: { ...clockService.options, bg_color: '#ff0000', font_color: '#00ff00' },
    };
    const { container } = wrap(<WidgetCard service={service} editMode={false} />, 'classic');
    const card = container.querySelector('.classic-card') as HTMLElement;
    expect(card.style.getPropertyValue('--card-bg')).toBe('#ff0000');
    expect(card.style.getPropertyValue('--card-fg')).toBe('#00ff00');
  });

  it('applies custom colors unchanged when authored under the active theme', () => {
    setThemeVar('--card-bg', '#000000');
    setThemeVar('--text-primary', '#000000');
    const service: ServiceConfig = {
      ...clockService,
      id: 'same-theme-colors',
      options: { ...clockService.options, font_color: '#000000', color_theme: 'ascii' },
    };
    const { container } = wrap(<WidgetCard service={service} editMode={false} />, 'ascii');
    const card = container.querySelector('.ascii-card') as HTMLElement;
    expect(card.style.getPropertyValue('--card-fg')).toBe('#000000');
  });

  it('drops a font_color that fails contrast under a different theme', () => {
    setThemeVar('--card-bg', '#ffffff');
    setThemeVar('--text-primary', '#ffffff');
    const service: ServiceConfig = {
      ...clockService,
      id: 'diff-theme-fail',
      options: { ...clockService.options, font_color: '#fefefe', color_theme: 'classic' },
    };
    const { container } = wrap(<WidgetCard service={service} editMode={false} />, 'atom');
    const card = container.querySelector('.atom-card') as HTMLElement;
    expect(card.style.getPropertyValue('--card-fg')).toBe('');
  });

  it('keeps a font_color that passes contrast under a different theme', () => {
    setThemeVar('--card-bg', '#ffffff');
    setThemeVar('--text-primary', '#ffffff');
    const service: ServiceConfig = {
      ...clockService,
      id: 'diff-theme-pass',
      options: { ...clockService.options, font_color: '#000000', color_theme: 'classic' },
    };
    const { container } = wrap(<WidgetCard service={service} editMode={false} />, 'liquid-glass');
    const card = container.querySelector('.liquid-card') as HTMLElement;
    expect(card.style.getPropertyValue('--card-fg')).toBe('#000000');
  });
});

describe('WidgetCard — hidden header in edit mode', () => {
  const hidden: ServiceConfig = {
    ...clockService,
    id: 'clock-hh',
    options: { ...clockService.options, hideHeader: true },
  };

  it('hides the header immediately in edit mode', () => {
    const { container } = wrap(<WidgetCard service={hidden} editMode={true} />);
    expect(container.querySelector('.widget-header')).toBeNull();
  });

  it('moves the drag handle into the always-on flyout', () => {
    const { container } = wrap(<WidgetCard service={hidden} editMode={true} />);
    const flyout = container.querySelector('.widget-edit-flyout--always');
    expect(flyout).not.toBeNull();
    expect(flyout!.querySelector('.grid-drag-handle')).not.toBeNull();
  });

  it('keeps the header when hideHeader is off', () => {
    const { container } = wrap(<WidgetCard service={clockService} editMode={true} />);
    expect(container.querySelector('.widget-header')).not.toBeNull();
    expect(container.querySelector('.widget-edit-flyout--always')).toBeNull();
  });
});
