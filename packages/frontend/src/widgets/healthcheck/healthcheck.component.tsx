import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import { AppIcon, hasServiceIcon, toAbsoluteUrl } from '../shared/app-icon.component';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';

function isPingData(x: unknown): x is { status: 'up' | 'down' } {
  return typeof x === 'object' && x !== null && 'status' in x;
}

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const layoutSizeRaw = options['layoutSize'];
  const layoutSize: HealthcheckLayoutSize =
    layoutSizeRaw === 'tiny' || layoutSizeRaw === 'big' ? layoutSizeRaw : 'normal';

  const appName       = typeof options['_title']          === 'string' ? options['_title']          : '';
  const description   = typeof options['description']     === 'string' ? options['description']     : undefined;
  const iconValue     = typeof options['_icon']           === 'string' ? options['_icon']           : '';
  const internalUrl   = typeof options['internalUrl']     === 'string' ? options['internalUrl']     : undefined;
  const pingIndicator = typeof options['pingIndicator']   === 'string' ? options['pingIndicator']   : 'header-bar';
  const hasIcon       = hasServiceIcon(iconValue);
  const isPingEnabled = options['ping'] !== false;
  const isDown        = isPingEnabled && isPingData(data) && data.status === 'down';

  // Tiny layout: icon is rendered in the widget-card header (see widget-card.component.tsx).
  if (layoutSize === 'tiny') {
    return null;
  }

  const iconAreaClass = [
    'healthcheck-widget__icon-area',
    pingIndicator === 'icon-glow' && isDown ? 'healthcheck-widget__icon-area--down' : '',
  ].filter(Boolean).join(' ');

  function iconEl(size: number) {
    if (!hasIcon) return null;
    const svg = <AppIcon iconValue={iconValue} size={size} title={description} />;
    if (internalUrl) {
      return (
        <a
          href={toAbsoluteUrl(internalUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="healthcheck-widget__icon-link"
          aria-label={appName || description}
        >
          {svg}
        </a>
      );
    }
    return svg;
  }

  if (layoutSize === 'big') {
    return (
      <div className="healthcheck-widget healthcheck-widget--big">
        <div className={`${iconAreaClass} healthcheck-widget__icon-area--big`}>
          {iconEl(64)}
        </div>
      </div>
    );
  }

  // normal
  return (
    <div className="healthcheck-widget healthcheck-widget--normal">
      <div className={iconAreaClass}>
        {iconEl(40)}
      </div>
      {appName && (
        <span className={`healthcheck-widget__name${pingIndicator === 'name' && isDown ? ' healthcheck-widget__name--down' : ''}`}>
          {appName}
        </span>
      )}
    </div>
  );
}
