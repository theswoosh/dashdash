import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n';
import { WidgetTemplateConfigModal } from '../components/widget-template-config-modal.component';

const EN_TRANSLATIONS = {
  en: {
    common: { save: 'Save', cancel: 'Cancel', close: 'Close', reset: 'Reset' },
    widgetConfig: { widgetBackground: 'Widget background' },
    widgetTemplateConfig: {
      title: 'Defaults: {{label}}',
      configureAria: 'Configure {{label}} defaults',
      defaultSize: 'Default size',
      width: 'Width',
      height: 'Height',
      layoutSize: 'Default layout size',
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

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WidgetTemplateConfigModal', () => {
  it('shows default size + background but no layout-size select for a type without layoutSize', () => {
    wrap(<WidgetTemplateConfigModal type="clock" onClose={() => {}} />);
    expect(screen.getByText('Default size')).toBeInTheDocument();
    expect(screen.getByText('Widget background')).toBeInTheDocument();
    expect(screen.queryByText('Default layout size')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the layout-size select for healthcheck', () => {
    wrap(<WidgetTemplateConfigModal type="healthcheck" onClose={() => {}} />);
    expect(screen.getByText('Default layout size')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('PATCHes the template defaults on save and closes', async () => {
    const onClose = vi.fn();
    wrap(<WidgetTemplateConfigModal type="clock" onClose={onClose} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/widget-templates/clock'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
