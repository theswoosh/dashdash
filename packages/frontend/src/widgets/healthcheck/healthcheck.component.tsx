import { useState, useEffect } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import { SI_PREFIX, slugFromValue } from '../../components/service-icon-picker.component';
import type { ServiceIcon } from '../../components/service-icons.data';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';

// ── Icon resolution hook ─────────────────────────────────────────────────

function useServiceIcon(iconValue: string): ServiceIcon | null {
  const [icon, setIcon] = useState<ServiceIcon | null>(null);

  useEffect(() => {
    const slug = slugFromValue(iconValue);
    if (!slug) { setIcon(null); return; }
    void import('../../components/service-icons.data').then(mod => {
      setIcon(mod.SERVICE_ICONS.find(i => i.slug === slug) ?? null);
    });
  }, [iconValue]);

  return icon;
}

// ── Icon rendering ────────────────────────────────────────────────────────

function AppIcon({ iconValue, size }: { iconValue: string; size: number }) {
  const icon = useServiceIcon(iconValue);
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="healthcheck-widget__icon-svg"
    >
      <path d={icon.path} />
    </svg>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const layoutSizeRaw = options['layoutSize'];
  const layoutSize: HealthcheckLayoutSize =
    layoutSizeRaw === 'tiny' || layoutSizeRaw === 'big' ? layoutSizeRaw : 'normal';
  const appName = typeof options['_title'] === 'string' ? options['_title'] : '';
  const description = typeof options['description'] === 'string' ? options['description'] : '';
  const isShowDescription = Boolean(options['showDescription']);
  const iconValue = typeof options['_icon'] === 'string' ? options['_icon'] : '';
  const hasIcon = iconValue.startsWith(SI_PREFIX);

  const ping = (data && typeof data === 'object' && 'status' in (data as object))
    ? (data as { status: 'up' | 'down'; latencyMs?: number; error?: string })
    : null;

  if (layoutSize === 'tiny') {
    return <div className="healthcheck-widget healthcheck-widget--tiny" aria-label={appName} />;
  }

  if (layoutSize === 'big') {
    const statusLabel = loading ? 'Checking…' : ping?.status === 'up' ? 'Up' : ping?.status === 'down' ? 'Down' : '…';
    const latencyLabel = ping?.status === 'up' && ping.latencyMs !== undefined ? `${ping.latencyMs}ms` : '';
    return (
      <div className="healthcheck-widget healthcheck-widget--big">
        <div className="healthcheck-widget__icon-area" title={appName} aria-label={`${appName} icon`}>
          {hasIcon && <AppIcon iconValue={iconValue} size={56} />}
        </div>
        <div className="healthcheck-widget__big-info">
          <span className="healthcheck-widget__big-name">{appName}</span>
          <span className={`healthcheck-widget__big-status healthcheck-widget__big-status--${ping?.status ?? 'unknown'}`}>
            {statusLabel}
          </span>
          {latencyLabel && <span className="healthcheck-widget__big-latency">{latencyLabel}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="healthcheck-widget healthcheck-widget--normal">
      <div className="healthcheck-widget__icon-area" aria-hidden="true">
        {hasIcon && <AppIcon iconValue={iconValue} size={28} />}
      </div>
      {isShowDescription && description && (
        <p className="healthcheck-widget__description">{description}</p>
      )}
    </div>
  );
}
