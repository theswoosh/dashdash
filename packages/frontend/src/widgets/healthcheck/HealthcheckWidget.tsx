import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/WidgetSkeleton';
import { WidgetError } from '../shared/WidgetError';
import './HealthcheckWidget.css';

interface HealthData {
  status: 'up' | 'down';
  statusCode?: number | undefined;
  latencyMs?: number | undefined;
  error?: string | undefined;
}

export function HealthcheckWidget({ options, data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const url = options['url'] as string | undefined;
  const d = data as HealthData | null;
  const status = d?.status ?? 'down';
  const isUp = status === 'up';

  return (
    <div className="healthcheck-widget">
      <div className={`healthcheck-widget__badge healthcheck-widget__badge--${status}`}>
        <span className="healthcheck-widget__dot" />
        <span className="healthcheck-widget__status">{isUp ? 'Online' : 'Offline'}</span>
      </div>
      {d?.latencyMs !== undefined && (
        <div className="healthcheck-widget__latency">{d.latencyMs}ms</div>
      )}
      {d?.statusCode !== undefined && (
        <div className="healthcheck-widget__code">HTTP {d.statusCode}</div>
      )}
      {url && (
        <div className="healthcheck-widget__url">{url}</div>
      )}
      {d?.error && !isUp && (
        <div className="healthcheck-widget__error">{d.error}</div>
      )}
    </div>
  );
}
