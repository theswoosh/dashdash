import type { ReactNode } from 'react';
import { renderWithLinks } from './linkify';

// Order matters: code spans are matched first so `**` inside `` ` `` isn't
// misparsed as bold. Each pattern is non-greedy and requires non-empty content.
const TOKEN_RE = /`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*/g;

/** Renders a safe markdown subset (bold/italic/strike/code) to React nodes —
 *  never HTML. Falls back to renderWithLinks's plain-text + link handling for
 *  any segment that isn't inside a recognized token. Shared by any widget that
 *  wants opt-in "markdown-lite" formatting (chat, notepad, ...). */
export function renderMarkdownLite(text: string, linkClassName: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(...renderWithLinks(text.slice(last, idx), linkClassName));
    const [, code, bold, strike, italic] = m;
    if (code !== undefined) parts.push(<code key={key++} className="chat-md-code">{code}</code>);
    else if (bold !== undefined) parts.push(<strong key={key++}>{renderWithLinks(bold, linkClassName)}</strong>);
    else if (strike !== undefined) parts.push(<s key={key++}>{renderWithLinks(strike, linkClassName)}</s>);
    else if (italic !== undefined) parts.push(<em key={key++}>{renderWithLinks(italic, linkClassName)}</em>);
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push(...renderWithLinks(text.slice(last), linkClassName));
  return parts;
}
