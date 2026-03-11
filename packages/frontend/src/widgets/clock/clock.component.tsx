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

  const timeStr = timeFmt.format(now);
  const dateStr = dateFmt.format(now);

  return (
    <div className="clock-widget">
      <div className="clock-widget__time">{timeStr}</div>
      <div className="clock-widget__date">{dateStr}</div>
      {isInvalidTimezone && timezone && (
        <div className="clock-widget__tz-error">Invalid timezone: {timezone}</div>
      )}
    </div>
  );
}
