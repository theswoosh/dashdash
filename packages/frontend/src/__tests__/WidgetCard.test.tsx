import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../themes/registry';
import { WidgetCard } from '../components/WidgetCard';

function wrap(ui: ReactNode, themeId = 'classic') {
  // Use 'classic' by default — ClassicCard has no canvas/ResizeObserver complexity
  return render(<ThemeProvider themeId={themeId}>{ui}</ThemeProvider>);
}

describe('WidgetCard — view mode', () => {
  it('renders the widget title', () => {
    wrap(<WidgetCard id="w1" title="My Widget" editMode={false} />);
    expect(screen.getByText('My Widget')).toBeInTheDocument();
  });

  it('renders the widget id as a placeholder', () => {
    wrap(<WidgetCard id="clock-main" title="Clock" editMode={false} />);
    expect(screen.getByText('clock-main')).toBeInTheDocument();
  });

  it('does not show drag handle when not in edit mode', () => {
    wrap(<WidgetCard id="w1" title="Widget" editMode={false} />);
    expect(screen.queryByTitle('Drag to move')).not.toBeInTheDocument();
  });
});

describe('WidgetCard — edit mode', () => {
  it('shows the drag handle', () => {
    wrap(<WidgetCard id="w1" title="Widget" editMode={true} />);
    expect(screen.getByTitle('Drag to move')).toBeInTheDocument();
  });
});

describe('WidgetCard — theme switching', () => {
  it('renders with ascii theme', () => {
    wrap(<WidgetCard id="w1" title="ASCII Widget" editMode={false} />, 'ascii');
    expect(screen.getByText('ASCII Widget')).toBeInTheDocument();
  });

  it('renders with liquid-glass theme (with canvas mock)', () => {
    wrap(<WidgetCard id="w1" title="Glass Widget" editMode={false} />, 'liquid-glass');
    expect(screen.getByText('Glass Widget')).toBeInTheDocument();
  });
});
