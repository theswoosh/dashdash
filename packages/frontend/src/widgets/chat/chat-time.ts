/** SQLite datetime('now') is UTC but has no zone marker ("2026-07-13 10:00:00");
 *  optimistic temp messages use ISO strings. Normalize both to a Date. */
export function parseMessageDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}

export function formatMessageTime(value: string): string {
  const date = parseMessageDate(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Local calendar day key, used for day separators and same-day checks. */
export function messageDayKey(value: string): string {
  const date = parseMessageDate(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
