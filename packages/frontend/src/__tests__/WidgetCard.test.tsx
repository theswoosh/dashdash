import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ServiceConfig } from '@dashdash/types';
import { ThemeProvider } from '../themes/registry';
import { WidgetCard } from '../components/widget-card.component';

function wrap(ui: ReactNode, themeId = 'classic') {
  // Use 'classic' by default — ClassicCard has no canvas/ResizeObserver complexity
  return render(<ThemeProvider themeId={themeId}>{ui}</ThemeProvider>);
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
