import type { CSSProperties } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { WidgetError } from '../shared/widget-error.component';
import { AppIcon, hasServiceIcon, toAbsoluteUrl } from '../shared/app-icon.component';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';
type ShowName = 'hidden' | 'above' | 'below';
type HealthcheckFontSize = 'S' | 'M' | 'L' | 'XL';

const FONT_SCALE_BY_SIZE: Record<HealthcheckFontSize, number> = {
  S: 0.85,
  M: 1,
  L: 1.25,
  XL: 1.55,
};

function isPingData(x: unknown): x is { status: 'up' | 'down' | 'unknown' | 'pending' } {
  return typeof x === 'object' && x !== null && 'status' in x;
}

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  // No loading gate: icon/name/description are static config and paint
  // immediately — only the ping status arrives async ('pending' shadow state).
  if (error) return <WidgetError message={error} />;

  const layoutSizeRaw = options['layoutSize'];
  const layoutSize: HealthcheckLayoutSize =
    layoutSizeRaw === 'tiny' || layoutSizeRaw === 'big' ? layoutSizeRaw : 'normal';

  const appName       = typeof options['_title']          === 'string' ? options['_title']          : '';
  const description   = typeof options['description']     === 'string' ? options['description']     : undefined;
  const iconValue     = typeof options['_icon']           === 'string' ? options['_icon']           : '';
  const internalUrl   = typeof options['internalUrl']     === 'string' ? options['internalUrl']     : undefined;
  const pingIndicator = typeof options['pingIndicator']   === 'string' ? options['pingIndicator']   : 'header-bar';
  const showNameRaw   = options['showName'];
  const showName: ShowName =
    showNameRaw === 'hidden' || showNameRaw === 'above' ? showNameRaw : 'below';
  const fontSizeRaw   = options['fontSize'];
  const fontSize: HealthcheckFontSize =
    fontSizeRaw === 'S' || fontSizeRaw === 'L' || fontSizeRaw === 'XL' ? fontSizeRaw : 'M';
  const hasIcon       = hasServiceIcon(iconValue);
  const isPingEnabled = options['ping'] !== false;
  const isDown        = isPingEnabled && isPingData(data) && data.status === 'down';
  const isPending     = isPingEnabled && (loading || (isPingData(data) && data.status === 'pending'));

  // Tiny layout: icon is rendered in the widget-card header (see widget-card.component.tsx).
  if (layoutSize === 'tiny') {
    return null;
  }

  const iconAreaClass = [
    'healthcheck-widget__icon-area',
    pingIndicator === 'icon-glow' && isDown ? 'healthcheck-widget__icon-area--down' : '',
    isPending ? 'healthcheck-widget__icon-area--pending' : '',
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

  // The name is a link to the app whenever internalUrl is set — visually
  // unchanged (inherits color/decoration), so the app stays reachable even
  // without an icon (live issue #1.3).
  function nameEl() {
    if (showName === 'hidden' || !appName) return null;
    const cls = `healthcheck-widget__name${pingIndicator === 'name' && isDown ? ' healthcheck-widget__name--down' : ''}`;
    if (internalUrl) {
      return (
        <a
          href={toAbsoluteUrl(internalUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} healthcheck-widget__name-link`}
        >
          {appName}
        </a>
      );
    }
    return <span className={cls}>{appName}</span>;
  }

  const modifier = layoutSize === 'big' ? 'healthcheck-widget--big' : 'healthcheck-widget--normal';
  const iconSize = layoutSize === 'big' ? 64 : 40;
  const iconArea = (
    <div className={`${iconAreaClass}${layoutSize === 'big' ? ' healthcheck-widget__icon-area--big' : ''}`}>
      {iconEl(iconSize)}
    </div>
  );

  const fontScale = FONT_SCALE_BY_SIZE[fontSize];

  return (
    <div
      className={`healthcheck-widget ${modifier}`}
      style={{ '--hc-font-scale': fontScale } as CSSProperties}
    >
      {showName === 'above' && nameEl()}
      {iconArea}
      {showName === 'below' && nameEl()}
    </div>
  );
}
