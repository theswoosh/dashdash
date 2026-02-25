import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './StatsWidget.css';

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const THRESHOLD_CRITICAL = 85;
const THRESHOLD_WARNING = 65;

const COLOR_CRITICAL = '#ef4444';
const COLOR_WARNING = '#f59e0b';
const COLOR_HEALTHY = '#22c55e';

interface StatsData {
  cpuLoadPct: number;
  memUsedPct: number;
  memUsedMb: number;
  memTotalMb: number;
  uptimeSecs: number;
}

function formatUptime(secs: number): string {
  const days = Math.floor(secs / SECONDS_PER_DAY);
  const hours = Math.floor((secs % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((secs % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function thresholdColor(value: number): string {
  if (value > THRESHOLD_CRITICAL) return COLOR_CRITICAL;
  if (value > THRESHOLD_WARNING) return COLOR_WARNING;
  return COLOR_HEALTHY;
}

interface BarProps {
  label: string;
  value: number;
  subtitle?: string | undefined;
}

function StatBar({ label, value, subtitle }: BarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = thresholdColor(clamped);
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

  const statsData = data as StatsData | null;
  if (!statsData) return <WidgetError message="No data" />;

  return (
    <div className="stats-widget">
      <StatBar label="CPU" value={statsData.cpuLoadPct} />
      <StatBar
        label="RAM"
        value={statsData.memUsedPct}
        subtitle={`${statsData.memUsedMb} / ${statsData.memTotalMb} MB`}
      />
      <div className="stats-widget__uptime">
        Uptime: {formatUptime(statsData.uptimeSecs)}
      </div>
    </div>
  );
}
