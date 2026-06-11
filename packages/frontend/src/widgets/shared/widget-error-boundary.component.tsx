import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { WidgetError } from './widget-error.component';

interface Props {
  widgetType: string;
  crashedLabel: string;
  retryLabel: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors inside a single widget so one broken widget shows an
 * error card instead of unmounting the whole dashboard (the A-081 black-screen
 * class of bugs). Class component — error boundaries have no hook equivalent,
 * which is also why the labels arrive pre-translated as props.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Widget "${this.props.widgetType}" crashed:`, error, info.componentStack);
  }

  retry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="widget-error-boundary">
          <WidgetError message={this.props.crashedLabel} />
          <button type="button" className="widget-error-boundary__retry" onClick={this.retry}>
            {this.props.retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
