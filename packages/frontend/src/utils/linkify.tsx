import type { ReactNode } from 'react';

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

/** Splits text into plain segments and clickable <a> links for http(s) URLs. */
export function renderWithLinks(text: string, linkClassName: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    const href = m[0];
    // Defence-in-depth: validate scheme even though regex already ensures it
    if (/^https?:\/\//i.test(href)) {
      parts.push(
        <a key={idx} href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
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
