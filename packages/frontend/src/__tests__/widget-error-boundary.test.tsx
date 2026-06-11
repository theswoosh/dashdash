import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { WidgetErrorBoundary } from '../widgets/shared/widget-error-boundary.component';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>widget content</div>;
}

describe('WidgetErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors — keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <WidgetErrorBoundary widgetType="clock" crashedLabel="Widget crashed" retryLabel="Retry">
        <Bomb shouldThrow={false} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText('widget content')).toBeInTheDocument();
  });

  it('shows the crash card instead of unmounting the tree', () => {
    render(
      <WidgetErrorBoundary widgetType="clock" crashedLabel="Widget crashed" retryLabel="Retry">
        <Bomb shouldThrow={true} />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText('Widget crashed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retry re-renders the children', () => {
    function Harness() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <div>
          <button onClick={() => setShouldThrow(false)}>fix</button>
          <WidgetErrorBoundary widgetType="clock" crashedLabel="Widget crashed" retryLabel="Retry">
            <Bomb shouldThrow={shouldThrow} />
          </WidgetErrorBoundary>
        </div>
      );
    }
    render(<Harness />);
    expect(screen.getByText('Widget crashed')).toBeInTheDocument();

    fireEvent.click(screen.getByText('fix'));        // underlying cause fixed
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('widget content')).toBeInTheDocument();
  });
});
