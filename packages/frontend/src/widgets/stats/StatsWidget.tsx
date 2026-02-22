import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/WidgetSkeleton';
import { WidgetError } from '../shared/WidgetError';
import './StatsWidget.css';

interface StatsData {
  cpuLoadPct: number;
  memUsedPct: number;
  memUsedMb: number;
  memTotalMb: number;
  uptimeSecs: number;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface BarProps {
  label: string;
  value: number;
  subtitle?: string | undefined;
}

function StatBar({ label, value, subtitle }: BarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped > 85 ? '#ef4444' : clamped > 65 ? '#f59e0b' : '#22c55e';
  return (
    <div className="stats-widget__row">
      <div className="stats-widget__label-row">
        <span className="stats-widget__label">{label}</span>
        <span className="stats-widget__pct" style={{ color }}>{clamped}%</span>
      </div>
      <div className="stats-widget__track">
        <div
          className="stats-widget__fill"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      {subtitle && <div className="stats-widget__sub">{subtitle}</div>}
    </div>
  );
}

export function StatsWidget({ data, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const d = data as StatsData | null;
  if (!d) return <WidgetError message="No data" />;

  return (
    <div className="stats-widget">
      <StatBar label="CPU" value={d.cpuLoadPct} />
      <StatBar
        label="RAM"
        value={d.memUsedPct}
        subtitle={`${d.memUsedMb} / ${d.memTotalMb} MB`}
      />
      <div className="stats-widget__uptime">
        Uptime: {formatUptime(d.uptimeSecs)}
      </div>
    </div>
  );
}
