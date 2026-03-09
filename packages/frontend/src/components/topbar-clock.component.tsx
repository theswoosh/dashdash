import { useState, useEffect } from 'react';

interface Props {
  format?: string | undefined;
  timezone?: string | undefined;
  showSeconds?: boolean | undefined;
}

export function TopbarClock({ format, timezone, showSeconds }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const resolvedFormat = format ?? '24h';
  const isShowSeconds = showSeconds !== false;

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: isShowSeconds ? '2-digit' : undefined,
    hour12: resolvedFormat === '12h',
    timeZone: timezone || undefined,
  }).format(now);

  return <span className="topbar-clock">{timeStr}</span>;
}
