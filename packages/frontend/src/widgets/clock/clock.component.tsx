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

  const timeFmt = useMemo(() => new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: format === '12h',
    timeZone: timezone,
  }), [format, timezone, showSeconds]);

  const dateFmt = useMemo(() => new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }), [timezone]);

  const timeStr = timeFmt.format(now);
  const dateStr = dateFmt.format(now);

  return (
    <div className="clock-widget">
      <div className="clock-widget__time">{timeStr}</div>
      <div className="clock-widget__date">{dateStr}</div>
    </div>
  );
}
