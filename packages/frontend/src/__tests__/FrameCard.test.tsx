import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ServiceConfig } from '@dashdash/types';
import { ThemeProvider } from '../themes/registry';
import { I18nProvider } from '../i18n';
import { FrameCard } from '../components/frame-card.component';

const EN_TRANSLATIONS = {
  en: {
    widgetCard: {
      dragToMove: 'Drag to move',
      holdToDelete: 'Hold to delete',
      holdToDeleteAria: 'Hold to delete widget',
      configureWidget: 'Configure widget',
    },
  },
};

function wrap(ui: ReactNode, themeId = 'classic') {
  return render(
    <I18nProvider language="en" translations={EN_TRANSLATIONS} availableLanguages={['en']}>
      <ThemeProvider themeId={themeId}>{ui}</ThemeProvider>
    </I18nProvider>
  );
}

const gridConfig = { rowHeight: 40, gap: 8 };
const renderConfig = { rowHeight: 40, gap: 8 };

const frameService: ServiceConfig = {
  id: 'frame-1',
  title: 'My Frame',
  widget: 'frame',
  layout: { w: 4, h: 4, x: 0, y: 0 },
  options: {},
  children: [],
};

function renderFrame(service: ServiceConfig, themeId: string) {
  return wrap(
    <FrameCard
      service={service}
      editMode={false}
      gridConfig={gridConfig}
      renderConfig={renderConfig}
      reloadServices={() => undefined}
    />,
    themeId,
  );
}

describe('FrameCard — widget bg locked under glass/ascii/atom themes', () => {
  it('drops a custom hex bg_color under atom (locked theme)', () => {
    const service: ServiceConfig = {
      ...frameService,
      id: 'locked-hex-bg',
      options: { ...frameService.options, bg_color: '#ff0000' },
    };
    const { container } = renderFrame(service, 'atom');
    const card = container.querySelector('.frame-card') as HTMLElement;
    expect(card.style.background).toBe('');
  });

  it('drops a token bg_color under atom (locked theme)', () => {
    const service: ServiceConfig = {
      ...frameService,
      id: 'locked-token-bg',
      options: { ...frameService.options, bg_color: 'token:accent' },
    };
    const { container } = renderFrame(service, 'atom');
    const card = container.querySelector('.frame-card') as HTMLElement;
    expect(card.style.background).toBe('');
  });

  it('applies a custom hex bg_color under classic (unlocked theme)', () => {
    const service: ServiceConfig = {
      ...frameService,
      id: 'unlocked-hex-bg',
      options: { ...frameService.options, bg_color: '#ff0000' },
    };
    const { container } = renderFrame(service, 'classic');
    const card = container.querySelector('.frame-card') as HTMLElement;
    expect(card.style.background).toBe('rgb(255, 0, 0)');
  });

  it('applies a token bg_color under classic (unlocked theme)', () => {
    const service: ServiceConfig = {
      ...frameService,
      id: 'unlocked-token-bg',
      options: { ...frameService.options, bg_color: 'token:accent' },
    };
    const { container } = renderFrame(service, 'classic');
    const card = container.querySelector('.frame-card') as HTMLElement;
    expect(card.style.background).toBe('var(--accent)');
  });
});
