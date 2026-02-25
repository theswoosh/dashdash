import { useState, useCallback, useRef, type ReactNode } from 'react';
import useSWR from 'swr';
import type { WidgetProps } from '@dashdash/types';
import './NotepadWidget.css';

const SAVE_DEBOUNCE_MS = 600;
const DEFAULT_POLLING_INTERVAL_SEC = 60;

const fetcher = (url: string) => fetch(url).then(r => r.json());

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

function renderWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const href = m[0];
    // Defence-in-depth: validate scheme even though regex already ensures it
    if (/^https?:\/\//i.test(href)) {
      parts.push(
        <a key={idx} href={href} target="_blank" rel="noopener noreferrer" className="notepad-link">
          {href}
        </a>
      );
    } else {
      parts.push(href);
    }
    last = idx + href.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function NotepadWidget({ serviceId, options }: WidgetProps) {
  const rawInterval = options.pollingInterval;
  const pollingInterval = typeof rawInterval === 'number' ? rawInterval : DEFAULT_POLLING_INTERVAL_SEC;

  const { data, mutate } = useSWR<{ content: string }>(
    `/api/notepad/${serviceId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: pollingInterval > 0 ? pollingInterval * 1000 : 0,
    }
  );

  const [focused, setFocused] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = data?.content ?? '';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      // Optimistic update
      void mutate({ content: value }, { revalidate: false });

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/notepad/${serviceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: value }),
        }).catch(() => { /* notepad save is best-effort */ });
      }, SAVE_DEBOUNCE_MS);
    },
    [serviceId, mutate]
  );

  if (focused) {
    return (
      <textarea
        className="notepad-textarea"
        value={content}
        onChange={handleChange}
        onBlur={() => setFocused(false)}
        autoFocus
        placeholder="Start typing notes…"
        spellCheck
      />
    );
  }

  return (
    <div
      className="notepad-display"
      onClick={() => setFocused(true)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFocused(true); }}
      aria-label="Click to edit note"
    >
      {content
        ? renderWithLinks(content).map((node, i) =>
            typeof node === 'string'
              ? node.split('\n').map((line, j, arr) => (
                  <span key={`${i}-${j}`}>
                    {line}
                    {j < arr.length - 1 && <br />}
                  </span>
                ))
              : node
          )
        : <span className="notepad-placeholder">Click to add notes…</span>
      }
    </div>
  );
}
