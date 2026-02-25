import { Globe } from 'lucide-react';
import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './HealthcheckWidget.css';

interface HealthData {
  status: 'up' | 'down';
  latencyMs?: number | undefined;
  error?: string | undefined;
}

/** Derive a short host string from the URL option and optional port. */
function hostLabel(url: string | undefined, port: number | undefined): string {
  if (!url) return 'No host';
  try {
    const normalized = url.includes('://') ? url : `http://${url}`;
    const parsed = new URL(normalized);
    return port ? `${parsed.hostname}:${port}` : parsed.host;
  } catch {
    return url;
  }
}

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const healthData = data as HealthData | null;
  const status = healthData?.status ?? 'down';
  const isUp = status === 'up';

  const host = hostLabel(
    options['url'] as string | undefined,
    options['port'] as number | undefined
  );

  const statusTooltip = isUp
    ? (healthData?.latencyMs !== undefined ? `${healthData.latencyMs}ms` : '')
    : (healthData?.error ?? '');

  return (
    <div className="healthcheck-widget">
      <div className="healthcheck-widget__icon" aria-hidden="true">
        <Globe size={28} />
      </div>
      <span className="healthcheck-widget__host" title={options['url'] as string | undefined}>
        {host}
      </span>
      <span
        className={`healthcheck-widget__status healthcheck-widget__status--${status}`}
        title={statusTooltip}
      >
        {isUp ? 'ok' : 'offline'}
      </span>
    </div>
  );
}
