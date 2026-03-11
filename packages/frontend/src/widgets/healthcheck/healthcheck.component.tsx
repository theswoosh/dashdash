import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const layoutSizeRaw = options['layoutSize'];
  const layoutSize: HealthcheckLayoutSize =
    layoutSizeRaw === 'tiny' || layoutSizeRaw === 'big' ? layoutSizeRaw : 'normal';
  const appName = typeof options['_title'] === 'string' ? options['_title'] : '';
  const description = typeof options['description'] === 'string' ? options['description'] : '';
  const isShowDescription = Boolean(options['showDescription']);

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
        <div className="healthcheck-widget__icon-area" title={appName} aria-label={`${appName} icon`} />
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
      <div className="healthcheck-widget__icon-area" aria-hidden="true" />
      {isShowDescription && description && (
        <p className="healthcheck-widget__description">{description}</p>
      )}
    </div>
  );
}
