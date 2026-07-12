import { memo, useMemo } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './StatsWidget.css';

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

// Fallbacks when no thresholds are configured (sidebar template defaults).
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

interface ThresholdPair {
  warn: number;
  crit: number;
}

const DEFAULT_THRESHOLDS: ThresholdPair = { warn: THRESHOLD_WARNING, crit: THRESHOLD_CRITICAL };

/** Read `{ warn, crit }` for one metric from options.thresholds, tolerating
 *  partial/malformed config (falls back per-field). */
function thresholdsFor(options: Record<string, unknown>, metric: 'cpu' | 'mem'): ThresholdPair {
  const root = options['thresholds'];
  if (typeof root !== 'object' || root === null) return DEFAULT_THRESHOLDS;
  const entry = (root as Record<string, unknown>)[metric];
  if (typeof entry !== 'object' || entry === null) return DEFAULT_THRESHOLDS;
  const { warn, crit } = entry as Record<string, unknown>;
  return {
    warn: typeof warn === 'number' ? warn : THRESHOLD_WARNING,
    crit: typeof crit === 'number' ? crit : THRESHOLD_CRITICAL,
  };
}

function isMetricShown(options: Record<string, unknown>, key: string): boolean {
  return options[key] !== false;
}

function formatUptime(secs: number): string {
  const days = Math.floor(secs / SECONDS_PER_DAY);
  const hours = Math.floor((secs % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((secs % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function thresholdColor(value: number, thresholds: ThresholdPair): string {
  if (value > thresholds.crit) return COLOR_CRITICAL;
  if (value > thresholds.warn) return COLOR_WARNING;
  return COLOR_HEALTHY;
}

interface BarProps {
  label: string;
  value: number;
  thresholds: ThresholdPair;
  subtitle?: string | undefined;
}

const StatBar = memo(function StatBar({ label, value, thresholds, subtitle }: BarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = thresholdColor(clamped, thresholds);
  const pctStyle = useMemo(() => ({ color }), [color]);
  const fillStyle = useMemo(() => ({ width: `${clamped}%`, background: color }), [clamped, color]);
  return (
    <div className="stats-widget__row">
      <div className="stats-widget__label-row">
        <span className="stats-widget__label">{label}</span>
        <span className="stats-widget__pct" style={pctStyle}>{clamped}%</span>
      </div>
      <div className="stats-widget__track">
        <div className="stats-widget__fill" style={fillStyle} />
      </div>
      {subtitle && <div className="stats-widget__sub">{subtitle}</div>}
    </div>
  );
});

function isStatsData(x: unknown): x is StatsData {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return typeof r['cpuLoadPct'] === 'number'
    && typeof r['memUsedPct'] === 'number'
    && typeof r['memUsedMb'] === 'number'
    && typeof r['memTotalMb'] === 'number'
    && typeof r['uptimeSecs'] === 'number';
}

export function StatsWidget({ data, error, loading, options }: WidgetProps) {
  const cpuThresholds = useMemo(() => thresholdsFor(options, 'cpu'), [options]);
  const memThresholds = useMemo(() => thresholdsFor(options, 'mem'), [options]);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const statsData = isStatsData(data) ? data : null;
  if (!statsData) return <WidgetError message="No data" />;

  return (
    <div className="stats-widget">
      {isMetricShown(options, 'showCpu') && (
        <StatBar label="CPU" value={statsData.cpuLoadPct} thresholds={cpuThresholds} />
      )}
      {isMetricShown(options, 'showMem') && (
        <StatBar
          label="RAM"
          value={statsData.memUsedPct}
          thresholds={memThresholds}
          subtitle={`${statsData.memUsedMb} / ${statsData.memTotalMb} MB`}
        />
      )}
      {isMetricShown(options, 'showUptime') && (
        <div className="stats-widget__uptime">
          Uptime: {formatUptime(statsData.uptimeSecs)}
        </div>
      )}
    </div>
  );
}
