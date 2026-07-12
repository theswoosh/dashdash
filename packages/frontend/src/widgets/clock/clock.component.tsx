import { useState, useEffect, useMemo } from 'react';
import type { WidgetProps } from '@dashdash/types';
import './ClockWidget.css';

export function ClockWidget({ options }: WidgetProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const format = (options['format'] as string | undefined) ?? '24h';
  const timezone = options['timezone'] as string | undefined;
  const showSeconds = options['showSeconds'] !== false;
  const showTimezone = options['showTimezone'] === true;

  const isInvalidTimezone = useMemo(() => {
    if (!timezone) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return false;
    } catch {
      return true;
    }
  }, [timezone]);

  const timeFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: format === '12h',
        timeZone: timezone,
      });
    } catch {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: format === '12h',
      });
    }
  }, [format, timezone, showSeconds]);

  const dateFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      });
    } catch {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }, [timezone]);

  // DST-aware zone label, e.g. "Europe/Berlin · CEST (GMT+2)" in summer and
  // "… CET (GMT+1)" in winter — derived per render tick from Intl parts, so
  // it flips automatically on DST transitions. Client-side only.
  const tzFmt = useMemo(() => {
    if (!showTimezone || isInvalidTimezone) return null;
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      });
    } catch {
      return null;
    }
  }, [showTimezone, isInvalidTimezone, timezone]);

  const timeStr = timeFmt.format(now);
  const dateStr = dateFmt.format(now);

  let tzLabel: string | null = null;
  if (tzFmt) {
    const shortName = tzFmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value;
    // GMT offset via the longOffset name ("GMT+02:00" → "GMT+2").
    const offsetRaw = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? '';
    const offset = offsetRaw.replace(/^GMT([+-])0?(\d+):00$/, 'GMT$1$2').replace(/^GMT$/, 'GMT+0');
    const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Some zones have no locale abbreviation and yield "GMT+2" as the short
    // name — don't print the offset twice for those.
    tzLabel = shortName && !shortName.startsWith('GMT')
      ? `${zone} · ${shortName} (${offset})`
      : `${zone} · ${offset}`;
  }

  return (
    <div className="clock-widget">
      <div className="clock-widget__time">{timeStr}</div>
      <div className="clock-widget__date">{dateStr}</div>
      {tzLabel && <div className="clock-widget__tz">{tzLabel}</div>}
      {isInvalidTimezone && timezone && (
        <div className="clock-widget__tz-error">Invalid timezone: {timezone}</div>
      )}
    </div>
  );
}
